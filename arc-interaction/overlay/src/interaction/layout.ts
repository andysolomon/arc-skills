/**
 * A layout move, by FLIP: when a row is added or removed, the other rows travel to their
 * new places and don't jump there. Plain DOM code, no Foldkit.
 *
 *   First   each row's top is remembered from the last time the list changed
 *   Last    after the change, each row's new top is read
 *   Invert  the row is shifted back by the difference, with a transform, so it looks unmoved
 *   Play    a spring takes that shift to zero
 *
 * `offsetTop` ignores transforms, so a row measured in the middle of a move still reports
 * its true place. The list needs `position: relative` so the tops are measured from it.
 * A MutationObserver runs after the DOM change and before the browser paints, so the
 * inverted frame is the first one drawn.
 *
 * A row that is new has no First, so it isn't moved here. Its own CSS entrance plays.
 */
import { LAYOUT_MIN_MOVE_PX } from "./constants.ts"
import { offsetOf, type Playback, springTo } from "./motion.ts"

/** Starts watching `list`'s direct children. Returns the function that stops it. */
export const attachLayoutMoves = (list: HTMLElement): (() => void) => {
  const tops = new Map<Element, number>()
  const running = new Map<Element, Playback>()

  const measure = () => {
    tops.clear()
    for (const row of list.children) tops.set(row, (row as HTMLElement).offsetTop)
  }

  const onChange = () => {
    for (const child of list.children) {
      const row = child as HTMLElement
      const first = tops.get(row)
      const last = row.offsetTop
      if (first === undefined || first === last) continue
      // When a move is still in flight, stop it and start the new one from where the row is drawn.
      const playing = running.get(row)
      playing?.stop()
      const shift = first + (playing === undefined ? 0 : offsetOf(row, "y")) - last
      if (Math.abs(shift) < LAYOUT_MIN_MOVE_PX) continue
      const mine = springTo(row, "y", shift, 0, 0)
      running.set(row, mine)
      void mine.finished.then(() => {
        if (running.get(row) === mine) running.delete(row)
      })
    }
    for (const row of running.keys()) if (!row.isConnected) running.delete(row)
    measure()
  }

  measure()
  const mutations = new MutationObserver(onChange)
  mutations.observe(list, { childList: true })
  // A row that grows or shrinks moves the rows under it without a child being added or
  // removed. That is not animated, but the remembered tops must follow it.
  const resizes = new ResizeObserver(measure)
  resizes.observe(list)

  return () => {
    mutations.disconnect()
    resizes.disconnect()
    for (const playback of running.values()) playback.stop()
    running.clear()
  }
}
