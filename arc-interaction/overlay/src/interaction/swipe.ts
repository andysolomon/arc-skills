/**
 * Swipe to dismiss, as plain DOM code. Pointer events go in, one callback comes out. No Foldkit and
 * no Effect here, so the Mount in mounts.ts stays a thin wrapper and the two pure functions
 * below test in Node.
 *
 * The row's offset is the one piece of state that lives outside the Model. It exists only
 * while the element does, and nothing reads it but this file. The Model learns one fact,
 * through `onDismissed`: the row has left the screen.
 *
 * The stylesheet sets `touch-action: pan-y` on the row, so the browser keeps vertical
 * scroll and hands sideways movement to this code.
 */
import { DISMISS_DISTANCE_RATIO, DISMISS_VELOCITY, DRAG_SLOP_PX, EXIT_MARGIN_PX, VELOCITY_WINDOW_MS } from "./constants.ts"
import { exitTo, offsetOf, place, type Playback, springTo } from "./motion.ts"

export type Sample = Readonly<{ t: number; x: number }>
export type Release = "dismiss-left" | "dismiss-right" | "return"

/** Px per second over the last VELOCITY_WINDOW_MS before `now`. Zero when the pointer had stopped. */
export const velocityOf = (samples: ReadonlyArray<Sample>, now: number): number => {
  const recent = samples.filter((s) => now - s.t <= VELOCITY_WINDOW_MS)
  const first = recent[0]
  const last = recent[recent.length - 1]
  if (first === undefined || last === undefined || last.t === first.t) return 0
  return ((last.x - first.x) / (last.t - first.t)) * 1000
}

/** What a release means. Pure. Offset and width are in px, velocity in px per second. */
export const decideRelease = (offset: number, velocity: number, width: number): Release => {
  const away = Math.sign(velocity) === Math.sign(offset)
  const fast = Math.abs(velocity) > DISMISS_VELOCITY
  const far = Math.abs(offset) > width * DISMISS_DISTANCE_RATIO
  // A fast flick decides by its direction. A slow release decides by where the row is.
  const dismiss = fast ? away : far
  if (!dismiss || offset === 0) return "return"
  return offset < 0 ? "dismiss-left" : "dismiss-right"
}

/** Starts listening on `row`. Returns the function that stops it. `onDismissed` runs at most once. */
export const attachSwipe = (row: HTMLElement, onDismissed: () => void): (() => void) => {
  let offset = 0
  let pointerId: number | null = null
  let dragging = false
  let startClientX = 0
  let startClientY = 0
  let startOffset = 0
  let samples: Array<Sample> = []
  let running: Playback | null = null
  let dismissed = false
  let detached = false
  let swallowClick = false

  const startDrag = (event: PointerEvent) => {
    dragging = true
    // Capture, so the row keeps the pointer when it leaves the row or the window.
    row.setPointerCapture(event.pointerId)
    row.setAttribute("data-dragging", "")
    getSelection()?.removeAllRanges()
  }

  const endDrag = (event: PointerEvent) => {
    dragging = false
    pointerId = null
    if (row.hasPointerCapture(event.pointerId)) row.releasePointerCapture(event.pointerId)
    row.removeAttribute("data-dragging")
  }

  const settle = (velocity: number) => {
    const mine = springTo(row, "x", offset, 0, velocity)
    running = mine
    void mine.finished.then(() => {
      if (running !== mine || detached) return // a second touch took the row over
      running = null
      offset = 0
      place(row, "x", 0)
    })
  }

  const dismiss = (direction: -1 | 1, velocity: number) => {
    dismissed = true
    const mine = exitTo(row, "x", offset, direction * (row.offsetWidth + EXIT_MARGIN_PX), velocity)
    running = mine
    void mine.finished.then(() => {
      if (!detached) onDismissed()
    })
  }

  const onDown = (event: PointerEvent) => {
    // There is no check for an earlier pointer. One that was released outside the row, before
    // the drag began, never sent its pointerup here. A new primary press replaces it.
    if (dismissed || dragging || !event.isPrimary || event.button !== 0) return
    pointerId = event.pointerId
    startClientX = event.clientX
    startClientY = event.clientY
    samples = [{ t: event.timeStamp, x: event.clientX }]
    if (running !== null) {
      // A spring is in flight. Stop it and start the drag from where the row is drawn, so it doesn't jump.
      running.stop()
      running = null
      offset = offsetOf(row, "x")
      place(row, "x", offset)
      startDrag(event)
    }
    startOffset = offset
  }

  const onMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    if (!dragging) {
      const dx = event.clientX - startClientX
      if (Math.abs(dx) < DRAG_SLOP_PX) return
      if (Math.abs(event.clientY - startClientY) > Math.abs(dx)) {
        pointerId = null // more down than across: not a swipe
        return
      }
      startDrag(event)
      startClientX = event.clientX // measure from here, so the row doesn't jump by the slop
    }
    samples.push({ t: event.timeStamp, x: event.clientX })
    if (samples.length > 20) samples.shift()
    offset = startOffset + (event.clientX - startClientX)
    place(row, "x", offset)
  }

  const onUp = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    const wasDragging = dragging
    endDrag(event)
    if (!wasDragging) return // a tap: the button gets its click
    swallowClick = true
    setTimeout(() => (swallowClick = false), 0)
    const velocity = velocityOf(samples, event.timeStamp)
    const release = decideRelease(offset, velocity, row.offsetWidth)
    if (release === "return") settle(velocity)
    else dismiss(release === "dismiss-left" ? -1 : 1, velocity)
  }

  // The browser took the pointer (a scroll started, the window lost focus), so the row goes home.
  const onCancel = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    const wasDragging = dragging
    endDrag(event)
    if (wasDragging) settle(0)
  }

  // A drag that began on the Remove button must not end as a click on it.
  const onClickCapture = (event: MouseEvent) => {
    if (!swallowClick) return
    swallowClick = false
    event.stopPropagation()
    event.preventDefault()
  }

  row.addEventListener("pointerdown", onDown)
  row.addEventListener("pointermove", onMove)
  row.addEventListener("pointerup", onUp)
  row.addEventListener("pointercancel", onCancel)
  row.addEventListener("click", onClickCapture, true)

  return () => {
    detached = true
    running?.stop()
    row.removeEventListener("pointerdown", onDown)
    row.removeEventListener("pointermove", onMove)
    row.removeEventListener("pointerup", onUp)
    row.removeEventListener("pointercancel", onCancel)
    row.removeEventListener("click", onClickCapture, true)
  }
}
