/**
 * THE MOUNT: where the scene enters the view. Attach it to the canvas with
 * `h.OnMount(HostScene({ initialBars, initialTurns }))`.
 *
 * Everything with a lifetime is built inside Effect.acquireRelease, in the acquire body,
 * so the release runs when the canvas leaves the page: first the watchers, then the scene.
 * The args are read once. They are named `initial…` because a later render never reaches
 * this code; later changes arrive through commands.ts.
 *
 * It is a stream Mount because the canvas keeps reporting for as long as it lives: started
 * or failed once, then context lost and restored whenever the browser decides.
 */
import { Effect, Queue, Schema, Stream } from "effect"
import { Mount } from "foldkit"
import { Bars } from "./data.ts"
import { registerScene, type SceneHandle, unregisterScene } from "./handle.ts"
import { SceneMessage } from "./model.ts"
import { readTokens } from "./tokens.ts"

type Reported =
  | typeof SceneMessage.StartedScene.Type
  | typeof SceneMessage.FailedStartScene.Type
  | typeof SceneMessage.LostSceneContext.Type
  | typeof SceneMessage.RestoredSceneContext.Type

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/**
 * Ask for a WebGL 2 context on a throwaway canvas before downloading three.js. three.js
 * needs WebGL 2, and a browser without it should get the table at once, not after a
 * download. The probe context is given back straight away.
 */
const hasWebGL2 = (document: Document): boolean => {
  const gl = document.createElement("canvas").getContext("webgl2")
  if (gl === null) return false
  gl.getExtension("WEBGL_lose_context")?.loseContext()
  return true
}

/** Everything that tells the scene about the world around the canvas. Returns its own undo. */
const watch = (canvas: HTMLCanvasElement, handle: SceneHandle, report: (message: Reported) => void): (() => void) => {
  const document = canvas.ownerDocument
  const view = document.defaultView!
  const repaint = () => handle.setPalette(readTokens(canvas.parentElement ?? document.body).palette)

  const resizes = new ResizeObserver(() => handle.resize())
  resizes.observe(canvas)
  const crossings = new IntersectionObserver((entries) => handle.setOnScreen(entries.at(-1)?.isIntersecting ?? true))
  crossings.observe(canvas)
  // arc-design forces dark with data-theme on <html>, so that attribute is a scheme change too.
  const themes = new MutationObserver(repaint)
  themes.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
  const scheme = view.matchMedia("(prefers-color-scheme: dark)")
  scheme.addEventListener("change", repaint)

  const onVisibility = () => handle.setTabVisible(document.visibilityState !== "hidden")
  document.addEventListener("visibilitychange", onVisibility)
  // three.js already cancels the default on "lost", which is what lets the browser restore it.
  const onLost = () => { handle.setContextLost(true); report(SceneMessage.LostSceneContext()) }
  const onRestored = () => { handle.setContextLost(false); report(SceneMessage.RestoredSceneContext()) }
  canvas.addEventListener("webglcontextlost", onLost)
  canvas.addEventListener("webglcontextrestored", onRestored)

  return () => {
    resizes.disconnect()
    crossings.disconnect()
    themes.disconnect()
    scheme.removeEventListener("change", repaint)
    document.removeEventListener("visibilitychange", onVisibility)
    canvas.removeEventListener("webglcontextlost", onLost)
    canvas.removeEventListener("webglcontextrestored", onRestored)
  }
}

export const HostScene = Mount.defineStream("HostScene", {
  args: { initialBars: Bars, initialTurns: Schema.Number },
  messages: [SceneMessage.StartedScene, SceneMessage.FailedStartScene, SceneMessage.LostSceneContext, SceneMessage.RestoredSceneContext],
  execute: ({ element, viewStateChanges, initialBars, initialTurns }) =>
    Stream.callback<Reported>((queue) =>
      Effect.gen(function*() {
        const report = (message: Reported) => void Queue.offerUnsafe(queue, message)
        const document = element.ownerDocument
        if (!(element instanceof document.defaultView!.HTMLCanvasElement) || !hasWebGL2(document)) {
          report(SceneMessage.FailedStartScene({ reason: "no WebGL 2 context" }))
          return yield* Effect.never
        }
        const canvas = element
        const motion = document.defaultView!.matchMedia("(prefers-reduced-motion: reduce)")

        // The scene: renderer, geometries, materials. Built after the chunk arrives, inside
        // the acquire body, so an unmount during the download leaves nothing to release.
        const started = yield* Effect.acquireRelease(
          Effect.tryPromise(() => import("./scene.ts")).pipe(
            Effect.flatMap(({ startScene }) =>
              Effect.try(() => {
                const { palette, timing } = readTokens(canvas.parentElement ?? document.body)
                const handle = startScene(canvas, { bars: initialBars, turns: initialTurns, palette, timing, reducedMotion: () => motion.matches })
                registerScene(canvas, handle)
                return handle
              })
            )
          ),
          (handle) => Effect.sync(() => { unregisterScene(canvas); handle.dispose() }),
          { interruptible: true }
        ).pipe(Effect.result)
        if (started._tag === "Failure") {
          report(SceneMessage.FailedStartScene({ reason: reason(started.failure) }))
          return yield* Effect.never
        }
        const handle = started.success

        // The watchers: observers and listeners, removed before the scene is disposed.
        yield* Effect.acquireRelease(Effect.sync(() => watch(canvas, handle, report)), (unwatch) => Effect.sync(unwatch))

        // Foldkit's time travel shows a historical view while the app keeps running. The
        // scene stops drawing for as long as that view is on screen.
        yield* Effect.forkScoped(Stream.runForEach(viewStateChanges, (state) => Effect.sync(() => handle.setLive(state === "Live"))))

        report(SceneMessage.StartedScene())
        return yield* Effect.never
      })
    )
})
