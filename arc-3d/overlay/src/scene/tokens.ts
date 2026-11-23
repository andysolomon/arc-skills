/**
 * TOKENS FOR THE SCENE: the one place where the app's design tokens become scene values.
 *
 * A shader can't read a CSS variable by name. So this module asks the browser for the
 * computed value of each token and hands the scene plain numbers. Call `readTokens` at
 * mount and again when the colour scheme changes. No other scene file names a colour.
 *
 * Two kinds of value live here and nowhere else:
 *   - colours and timings, read from tokens.css at run time;
 *   - SHADE, the face shading factors. They are multipliers, not colours, and CSS has no
 *     token for them.
 */

/** sRGB, each channel 0 to 255. */
export type Rgb = readonly [number, number, number]

export type Palette = Readonly<{
  /** --bg: the clear colour. */
  bg: Rgb
  /** --fg: the height scale and its ticks. */
  fg: Rgb
  /** --dim: the frame around the floor. */
  dim: Rgb
  /** --line: the slot grid on the floor. */
  line: Rgb
  /** --hi: the outline of the draft being typed. */
  hi: Rgb
  /** --c1 to --c4: stored, saving, saved and waiting, not saved. */
  series: readonly [Rgb, Rgb, Rgb, Rgb]
}>

export type Timing = Readonly<{
  /** --t-state in milliseconds: a turn of the view. */
  state: number
  /** --t-enter in milliseconds: a bar growing in. */
  enter: number
  /** --ease as a function from 0..1 to 0..1. */
  ease: (t: number) => number
}>

/**
 * How much of a bar's colour each face keeps: the top is the token colour exactly, the
 * sides are darker so the bar reads as a solid. Vertex colours carry these to the GPU.
 */
export const SHADE = { top: 1, side: 0.78, front: 0.6 } as const

const COLOUR_TOKENS = ["--bg", "--fg", "--dim", "--line", "--hi", "--c1", "--c2", "--c3", "--c4"] as const

/** "rgb(255, 46, 147)" or "rgba(255, 46, 147, 1)" to numbers. */
export const parseRgb = (computed: string): Rgb | undefined => {
  const match = /^rgba?\(\s*(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)/.exec(computed.trim())
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined
}

/** "220ms" or "0.22s" to milliseconds. Anything else is 0, which means no animation. */
export const parseMs = (value: string): number => {
  const match = /^(\d*\.?\d+)(ms|s)$/.exec(value.trim())
  return match ? Number(match[1]) * (match[2] === "s" ? 1000 : 1) : 0
}

/** "cubic-bezier(.2,.7,.2,1)" to an easing function. Anything else is linear. */
export const parseEase = (value: string): ((t: number) => number) => {
  const match = /^cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/.exec(value.trim())
  if (!match) return (t) => t
  const [x1, y1, x2, y2] = [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])]
  const bezier = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s ** 2 * (1 - s) + s ** 3
  return (t) => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    // Find the curve parameter whose x is t, by bisection. x is monotonic for a valid easing.
    let low = 0, high = 1
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2
      if (bezier(x1, x2, mid) < t) low = mid; else high = mid
    }
    return bezier(y1, y2, (low + high) / 2)
  }
}

/**
 * Read the tokens as the browser computes them for `scope`. A probe element takes each
 * token as its `color`, so the browser resolves hex, rgb(), named colours and the active
 * colour scheme, and always answers in rgb(). Throws when a token is missing or is not an
 * sRGB colour, and the Mount turns that into the fallback screen.
 */
export const readTokens = (scope: Element): { palette: Palette; timing: Timing } => {
  const probe = scope.ownerDocument.createElement("span")
  probe.hidden = true
  scope.appendChild(probe)
  try {
    const colour = (token: (typeof COLOUR_TOKENS)[number]): Rgb => {
      probe.style.color = `var(${token})`
      const rgb = parseRgb(getComputedStyle(probe).color)
      if (probe.style.color === "" || rgb === undefined) throw new Error(`token ${token} is not a colour the scene can read`)
      return rgb
    }
    const [bg, fg, dim, line, hi, c1, c2, c3, c4] = COLOUR_TOKENS.map(colour) as [Rgb, Rgb, Rgb, Rgb, Rgb, Rgb, Rgb, Rgb, Rgb]
    const style = getComputedStyle(scope)
    return {
      palette: { bg, fg, dim, line, hi, series: [c1, c2, c3, c4] },
      timing: {
        state: parseMs(style.getPropertyValue("--t-state")),
        enter: parseMs(style.getPropertyValue("--t-enter")),
        ease: parseEase(style.getPropertyValue("--ease"))
      }
    }
  } finally {
    probe.remove()
  }
}
