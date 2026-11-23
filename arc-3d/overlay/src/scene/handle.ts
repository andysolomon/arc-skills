/**
 * THE SCENE HANDLE: how a Command reaches the running scene.
 *
 * Mount args are read once, when the canvas enters the page. A later Model change reaches
 * the scene through a Command from `update`, and the Command needs the live scene. The
 * Mount registers its handle here under the canvas element, and removes it on release. The
 * map is weak and keyed by the element, so it holds no app state and can't keep a removed
 * canvas alive.
 *
 * No three.js import here: commands.ts and the Node tests load this file.
 */
import type { Bars } from "./data.ts"
import type { Palette } from "./tokens.ts"

export const SCENE_ID = "notes-scene"

export type SceneHandle = Readonly<{
  setBars: (bars: Bars) => void
  setTurns: (turns: number) => void
  setPalette: (palette: Palette) => void
  /** Match the drawing buffer to the element's size. */
  resize: () => void
  setOnScreen: (onScreen: boolean) => void
  setTabVisible: (tabVisible: boolean) => void
  /** False while Foldkit shows a historical view (time travel). */
  setLive: (live: boolean) => void
  setContextLost: (lost: boolean) => void
  dispose: () => void
}>

const live = new WeakMap<Element, SceneHandle>()

export const registerScene = (element: Element, handle: SceneHandle): void => void live.set(element, handle)
export const unregisterScene = (element: Element): void => void live.delete(element)

/** The running scene, or undefined when the canvas is not in the page or has not started. */
export const findScene = (): SceneHandle | undefined => {
  const element = document.getElementById(SCENE_ID)
  return element === null ? undefined : live.get(element)
}
