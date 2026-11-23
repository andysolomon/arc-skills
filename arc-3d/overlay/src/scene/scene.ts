/**
 * THE SCENE: the only file that imports three.js. The Mount loads it with a dynamic
 * import, so three.js is its own chunk and the Node tests never load it.
 *
 * It draws what data.ts lays out and nothing else: one instanced box per note, a floor
 * grid, a frame, a height scale, and an outline for the draft. Every colour arrives as a
 * Palette from tokens.ts. Geometry is built in code, so there is no model file to load.
 *
 * It renders on demand. A frame is drawn when something changed, and the loop keeps
 * running only while a transition is in flight and the gate (data.ts `canRender`) is open.
 * Under reduced motion a change is one frame.
 *
 * `startScene` builds every GPU resource and `dispose` frees every one. The Mount calls
 * them from Effect.acquireRelease, so they run in pairs.
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  EdgesGeometry,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  MeshBasicMaterial,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer
} from "three"
import { BAR_MAX, BAR_WIDTH, type BarState, type Bars, canRender, type Gate, LANE_OFFSET, type Layout, layoutOf, sameBars, type Slot } from "./data.ts"
import type { SceneHandle } from "./handle.ts"
import { type Palette, type Rgb, SHADE, type Timing } from "./tokens.ts"

/** Above 2 the drawing buffer grows fourfold or more and the picture barely changes. */
export const MAX_PIXEL_RATIO = 2

const EIGHTH_TURN = Math.PI / 4
const START_AZIMUTH = Math.PI / 6
const ELEVATION = Math.PI / 5.5
const FLOOR_DEPTH = LANE_OFFSET * 2
const MARGIN = 0.3
/** The fitted picture keeps this much room around it: 1.08 leaves 4% on each side. */
const FIT = 1.08
const TICK_LENGTH = 0.2

export type SceneInit = Readonly<{
  bars: Bars
  turns: number
  palette: Palette
  timing: Timing
  /** Asked at the start of each transition, so a changed setting applies to the next one. */
  reducedMotion: () => boolean
}>

type Pose = Readonly<{ x: number; z: number; height: number }>

const SERIES: Record<Exclude<BarState, "draft">, 0 | 1 | 2 | 3> = { stored: 0, saving: 1, saved: 2, failed: 3 }

const paint = (target: Color, rgb: Rgb): Color => target.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, SRGBColorSpace)
const mix = (from: number, to: number, k: number): number => from + (to - from) * k

/** A unit box standing on the floor. Vertex colours shade its faces (tokens.ts SHADE). */
const makeBox = (): BoxGeometry => {
  const box = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
  // BoxGeometry lists its faces as +x, -x, +y, -y, +z, -z, four vertices each.
  const shades = [SHADE.side, SHADE.side, SHADE.top, SHADE.top, SHADE.front, SHADE.front]
  const colours = new Float32Array(24 * 3)
  shades.forEach((shade, face) => colours.fill(shade, face * 12, face * 12 + 12))
  box.setAttribute("color", new BufferAttribute(colours, 3))
  return box
}

export const startScene = (canvas: HTMLCanvasElement, init: SceneInit): SceneHandle => {
  // Throws when the browser gives no WebGL 2 context. The Mount turns that into the fallback.
  const renderer = new WebGLRenderer({ canvas, antialias: true })
  const scene = new Scene()
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 1000)

  const box = makeBox()
  const edges = new EdgesGeometry(box)
  const barMaterial = new MeshBasicMaterial({ vertexColors: true })
  const gridMaterial = new LineBasicMaterial()
  const frameMaterial = new LineBasicMaterial()
  const scaleMaterial = new LineBasicMaterial()
  const draftMaterial = new LineBasicMaterial()

  const guide = (material: LineBasicMaterial): LineSegments<BufferGeometry, LineBasicMaterial> => {
    const lines = new LineSegments(new BufferGeometry(), material)
    scene.add(lines)
    return lines
  }
  const grid = guide(gridMaterial)
  const frame = guide(frameMaterial)
  const scale = guide(scaleMaterial)
  const draft = new LineSegments(edges, draftMaterial)
  draft.visible = false
  scene.add(draft)

  const makeBars = (capacity: number): InstancedMesh<BoxGeometry, MeshBasicMaterial> => {
    const mesh = new InstancedMesh(box, barMaterial, capacity)
    mesh.count = 0
    // Instances move every frame of a transition, so the cached bounds would be stale.
    mesh.frustumCulled = false
    scene.add(mesh)
    return mesh
  }
  let capacity = 64
  let barMesh = makeBars(capacity)

  // What is on screen ----------------------------------------------------------
  let palette = init.palette
  let bars: Bars = []
  let layout: Layout = layoutOf(bars)
  let solid: ReadonlyArray<Slot> = []
  let shown = new Map<string, Pose>()
  let from = new Map<string, Pose>()
  let barProgress = 1
  let turnTarget = init.turns * EIGHTH_TURN
  let turnFrom = turnTarget
  let turnProgress = 1
  let azimuth = turnTarget
  let size = { width: 0, height: 0, ratio: 0 }

  // The loop -------------------------------------------------------------------
  let gate: Gate = { onScreen: true, tabVisible: canvas.ownerDocument.visibilityState !== "hidden", live: true, contextLost: false }
  let raf = 0
  let last = 0
  let frames = 0
  let disposed = false

  const animating = (): boolean => barProgress < 1 || turnProgress < 1
  const open = (): boolean => !disposed && canRender(gate) && size.width > 0
  /** For the browser test and for arc-webgl-performance: what the loop is doing. */
  const report = (): void => {
    canvas.dataset.sceneFrames = String(frames)
    canvas.dataset.sceneState = disposed ? "disposed" : gate.contextLost ? "lost" : !open() ? "stopped" : animating() ? "animating" : "idle"
  }

  const matrix = new Matrix4()
  const colour = new Color()
  const corner = new Vector3()

  const fitCamera = (): void => {
    const half = layout.width / 2 + MARGIN
    const depth = FLOOR_DEPTH + MARGIN
    const angle = START_AZIMUTH + azimuth
    const distance = 50 + half
    const centre = BAR_MAX / 2
    camera.position.set(Math.sin(angle) * Math.cos(ELEVATION) * distance, centre + Math.sin(ELEVATION) * distance, Math.cos(angle) * Math.cos(ELEVATION) * distance)
    camera.lookAt(0, centre, 0)
    camera.updateMatrixWorld()
    // Fit the box that holds the floor and the tallest bar, as the camera sees it now.
    let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity
    for (const x of [-half, half]) for (const y of [0, BAR_MAX]) for (const z of [-depth, depth]) {
      corner.set(x, y, z).applyMatrix4(camera.matrixWorldInverse)
      left = Math.min(left, corner.x)
      right = Math.max(right, corner.x)
      bottom = Math.min(bottom, corner.y)
      top = Math.max(top, corner.y)
    }
    let halfWidth = ((right - left) / 2) * FIT
    let halfHeight = ((top - bottom) / 2) * FIT
    const aspect = size.width / size.height
    if (halfWidth / halfHeight > aspect) halfHeight = halfWidth / aspect; else halfWidth = halfHeight * aspect
    camera.left = (left + right) / 2 - halfWidth
    camera.right = (left + right) / 2 + halfWidth
    camera.top = (top + bottom) / 2 + halfHeight
    camera.bottom = (top + bottom) / 2 - halfHeight
    camera.far = distance * 4
    camera.updateProjectionMatrix()
  }

  const placeBars = (): void => {
    const k = init.timing.ease(barProgress)
    const next = new Map<string, Pose>()
    solid.forEach((slot, i) => {
      const start = from.get(slot.id) ?? { x: slot.x, z: slot.z, height: 0 }
      const pose = { x: mix(start.x, slot.x, k), z: mix(start.z, slot.z, k), height: mix(start.height, slot.height, k) }
      next.set(slot.id, pose)
      barMesh.setMatrixAt(i, matrix.makeScale(BAR_WIDTH, pose.height, BAR_WIDTH).setPosition(pose.x, 0, pose.z))
    })
    shown = next
    barMesh.count = solid.length
    barMesh.instanceMatrix.needsUpdate = true
  }

  const draw = (now: number): void => {
    raf = 0
    const elapsed = last === 0 ? 0 : now - last
    last = now
    barProgress = init.timing.enter > 0 ? Math.min(1, barProgress + elapsed / init.timing.enter) : 1
    turnProgress = init.timing.state > 0 ? Math.min(1, turnProgress + elapsed / init.timing.state) : 1
    azimuth = mix(turnFrom, turnTarget, init.timing.ease(turnProgress))
    fitCamera()
    placeBars()
    renderer.render(scene, camera)
    frames += 1
    if (animating() && open()) raf = requestAnimationFrame(draw); else last = 0
    report()
  }
  const stop = (): void => {
    if (raf !== 0) cancelAnimationFrame(raf)
    raf = 0
    last = 0
  }
  /** Ask for one frame. Does nothing while the gate is closed; opening the gate asks again. */
  const invalidate = (): void => {
    if (raf === 0 && open()) raf = requestAnimationFrame(draw)
    report()
  }
  const setGate = (patch: Partial<Gate>): void => {
    const next = { ...gate, ...patch }
    if (canRender(next) === canRender(gate) && next.contextLost === gate.contextLost) { gate = next; return }
    gate = next
    if (open()) invalidate(); else { stop(); report() }
  }

  // Resources that follow the data ----------------------------------------------
  const setPoints = (lines: LineSegments<BufferGeometry, LineBasicMaterial>, points: ReadonlyArray<number>): void => {
    lines.geometry.dispose()
    lines.geometry = new BufferGeometry().setAttribute("position", new BufferAttribute(new Float32Array(points), 3))
  }
  const buildGuides = (): void => {
    const half = layout.width / 2
    const slotLines: Array<number> = [-half, 0, 0, half, 0, 0]
    for (let i = 1; i < layout.width; i++) slotLines.push(-half + i, 0, -FLOOR_DEPTH, -half + i, 0, FLOOR_DEPTH)
    setPoints(grid, slotLines)
    setPoints(frame, [
      -half, 0, -FLOOR_DEPTH, half, 0, -FLOOR_DEPTH,
      half, 0, -FLOOR_DEPTH, half, 0, FLOOR_DEPTH,
      half, 0, FLOOR_DEPTH, -half, 0, FLOOR_DEPTH,
      -half, 0, FLOOR_DEPTH, -half, 0, -FLOOR_DEPTH
    ])
    // The scale stands at the front left corner, where no bar hides it in the starting view.
    const post: Array<number> = layout.maxChars === 0 ? [] : [-half, 0, FLOOR_DEPTH, -half, BAR_MAX, FLOOR_DEPTH]
    for (const tick of layout.ticks) post.push(-half, tick, FLOOR_DEPTH, -half + TICK_LENGTH, tick, FLOOR_DEPTH)
    setPoints(scale, post)
  }
  const colourBars = (): void => {
    solid.forEach((slot, i) => {
      if (slot.state !== "draft") barMesh.setColorAt(i, paint(colour, palette.series[SERIES[slot.state]]))
    })
    if (barMesh.instanceColor !== null) barMesh.instanceColor.needsUpdate = true
  }
  const applyPalette = (): void => {
    renderer.setClearColor(paint(colour, palette.bg))
    paint(gridMaterial.color, palette.line)
    paint(frameMaterial.color, palette.dim)
    paint(scaleMaterial.color, palette.fg)
    paint(draftMaterial.color, palette.hi)
    colourBars()
  }

  const setBars = (next: Bars, animate: boolean): void => {
    bars = next
    layout = layoutOf(bars)
    solid = layout.slots.filter((slot) => slot.state !== "draft")
    if (solid.length > capacity) {
      scene.remove(barMesh)
      barMesh.dispose()
      while (capacity < solid.length) capacity *= 2
      barMesh = makeBars(capacity)
    }
    // The draft follows the keys directly: it is the user's own input, so it does not ease.
    const typed = layout.slots.find((slot) => slot.state === "draft")
    draft.visible = typed !== undefined
    if (typed !== undefined) {
      draft.scale.set(BAR_WIDTH, typed.height, BAR_WIDTH)
      draft.position.set(typed.x, 0, typed.z)
    }
    const moved = solid.some((slot) => {
      const pose = shown.get(slot.id)
      return pose === undefined || pose.x !== slot.x || pose.z !== slot.z || pose.height !== slot.height
    })
    if (moved) {
      from = shown
      barProgress = animate && init.timing.enter > 0 && !init.reducedMotion() ? 0 : 1
    }
    buildGuides()
    colourBars()
    invalidate()
  }

  const resize = (): void => {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const ratio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO)
    if (width === 0 || height === 0) return
    if (width === size.width && height === size.height && ratio === size.ratio) return
    size = { width, height, ratio }
    renderer.setPixelRatio(ratio)
    // `false` leaves the element's CSS size alone: the stylesheet owns it.
    renderer.setSize(width, height, false)
    // setSize clears the buffer, so draw in the same task or the canvas flashes empty.
    if (open()) { stop(); draw(performance.now()) }
  }

  applyPalette()
  setBars(init.bars, true)
  resize()
  report()

  return {
    setBars: (next) => { if (!sameBars(bars, next)) setBars(next, true) },
    setTurns: (turns) => {
      const target = turns * EIGHTH_TURN
      if (target === turnTarget) return
      // Start from the nearest equal angle, so a reset turns the short way round.
      const away = azimuth - target
      turnFrom = target + Math.atan2(Math.sin(away), Math.cos(away))
      turnTarget = target
      turnProgress = init.timing.state > 0 && !init.reducedMotion() ? 0 : 1
      invalidate()
    },
    setPalette: (next) => {
      palette = next
      applyPalette()
      invalidate()
    },
    resize,
    setOnScreen: (onScreen) => setGate({ onScreen }),
    setTabVisible: (tabVisible) => setGate({ tabVisible }),
    setLive: (isLive) => setGate({ live: isLive }),
    setContextLost: (contextLost) => setGate({ contextLost }),
    dispose: () => {
      if (disposed) return
      disposed = true
      stop()
      scene.clear()
      barMesh.dispose()
      for (const lines of [grid, frame, scale]) lines.geometry.dispose()
      for (const geometry of [box, edges]) geometry.dispose()
      for (const material of [barMaterial, gridMaterial, frameMaterial, scaleMaterial, draftMaterial]) material.dispose()
      // What three.js still holds on the GPU after the disposals above. The browser test reads it.
      canvas.dataset.sceneGeometries = String(renderer.info.memory.geometries)
      renderer.dispose()
      // Give the context back now. A page may hold only a handful of WebGL contexts.
      renderer.forceContextLoss()
      report()
    }
  }
}
