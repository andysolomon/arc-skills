/**
 * The only file that imports Motion. Everything else asks for a spring or an exit by name.
 *
 * Two things Motion's plain `animate()` does not do for you, both found by test:
 *   - it ignores `prefers-reduced-motion` unless told (`reduceMotion` defaults to "animate").
 *     So every helper here checks the setting first and, when it is on, puts the element at
 *     its end place at once and never calls `animate()`.
 *   - it starts from its own record of the element, not from a transform set by hand. So
 *     every call passes both ends: `[from, to]`.
 *
 * Only `transform` moves: `x` and `y` are Motion's names for translateX and translateY.
 */
import { animate } from "motion"
import { EXIT_MIN_SPEED, SPRING } from "./constants.ts"

export type Axis = "x" | "y"

/** A running animation. `stop` leaves the element where it is right now. `finished` resolves when it ends or is stopped. */
export type Playback = Readonly<{ stop: () => void; finished: Promise<void> }>

const done: Playback = { stop: () => {}, finished: Promise.resolve() }

/** Read at each release, not once, so a setting changed while the app is open takes effect. */
export const prefersReducedMotion = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches

/** Put the element at an offset with no animation. The drag itself uses this, because the user is moving the row. */
export const place = (element: HTMLElement, axis: Axis, offset: number): void => {
  element.style.transform = offset === 0 ? "" : axis === "x" ? `translateX(${offset}px)` : `translateY(${offset}px)`
}

/** Where the element is drawn right now, including an animation in flight. */
export const offsetOf = (element: HTMLElement, axis: Axis): number => {
  const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
  return axis === "x" ? matrix.m41 : matrix.m42
}

const run = (element: HTMLElement, axis: Axis, to: number, start: () => { stop: () => void; finished: Promise<unknown> }): Playback => {
  if (prefersReducedMotion()) {
    place(element, axis, to)
    return done
  }
  const controls = start()
  // At rest Motion leaves an inline `transform: none`, which draws the same as no transform.
  const finished = controls.finished.then(() => undefined, () => undefined)
  return { stop: () => controls.stop(), finished }
}

/** A spring from `from` to `to` that starts at `velocity` px per second. Stop it at any time. */
export const springTo = (element: HTMLElement, axis: Axis, from: number, to: number, velocity: number): Playback =>
  run(element, axis, to, () => animate(element, { [axis]: [from, to] }, { type: "spring", ...SPRING, velocity }))

/** A straight run from `from` to `to` at the speed the finger left it with, and never slower than EXIT_MIN_SPEED. */
export const exitTo = (element: HTMLElement, axis: Axis, from: number, to: number, velocity: number): Playback => {
  const seconds = Math.abs(to - from) / Math.max(Math.abs(velocity), EXIT_MIN_SPEED)
  return run(element, axis, to, () => animate(element, { [axis]: [from, to] }, { duration: seconds, ease: "linear" }))
}
