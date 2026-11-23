/**
 * Spring and gesture numbers. This is the ONLY file that holds them.
 *
 * They can't be CSS tokens. A spring has no duration to name. Its length comes from the
 * stiffness, the damping and the speed the finger left it with. A gesture threshold is a
 * distance or a speed that script compares against, and CSS never reads it. So they live
 * here as named constants, and scripts/check-interaction.mjs fails the build when a spring
 * or velocity number appears in any other file.
 */

/**
 * The one spring. It takes a row back home, and it moves a row to its new place in the list.
 * `damping` sits just under critical damping (2 * sqrt(stiffness * mass) = 34.6), so a row
 * released at rest settles without a wobble, and a row released with speed overshoots once,
 * which is how the eye reads the carried velocity. Settles in about 0.4 s.
 */
export const SPRING = { stiffness: 300, damping: 30, mass: 1 } as const

/** A pointer must travel this far sideways before the row starts to follow. Below it, a press is a tap and reaches the button. */
export const DRAG_SLOP_PX = 8

/** Released further out than this share of the row's width, the row is dismissed even at no speed. */
export const DISMISS_DISTANCE_RATIO = 0.4

/** Released faster than this, in px per second, the row is dismissed even from a short distance. A flick that fast toward home sends it home. */
export const DISMISS_VELOCITY = 500

/** Velocity is the distance over the last this many milliseconds of the drag. Longer includes the slow start of the drag, shorter is noisy. */
export const VELOCITY_WINDOW_MS = 100

/** A dismissed row leaves at its release speed, and never slower than this, so a far, slow release doesn't crawl off. */
export const EXIT_MIN_SPEED = 1200

/** A dismissed row stops this far past its own width, so no part of it is left in view. */
export const EXIT_MARGIN_PX = 24

/** A list row that moved less than this, in px, is not animated. */
export const LAYOUT_MIN_MOVE_PX = 0.5
