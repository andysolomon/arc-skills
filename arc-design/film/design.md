---
# arc-design film spec. Copy this file to a new film's root as design.md.
# HyperFrames' skill reads the first of frame.md, design.md and DESIGN.md at a film's root
# and takes this frontmatter as the brand's exact values.
# Every value below is copied from arc-design/tokens.css, the dark values. Never edit one
# here: change tokens.css, then copy the value again. --link is left out: a film has no links.
version: alpha
name: arc-design
description: >
  True black ground, white text, one pink accent, Geist and Geist Mono. The black ground and
  Geist are this brand's own choices, so HyperFrames' default bans on them do not apply.

colors:
  bg: "#000"         # the ground
  fg: "#fff"         # text
  dim: "#a1a1aa"     # secondary text and labels
  line: "#27272a"    # borders and rules
  surface: "#0e0e11" # raised areas
  hi: "#ff2e93"      # the one accent
  on-hi: "#000"      # text on the accent
  ok: "#3ddc84"      # status only: pass
  bad: "#ff5a5f"     # status only: fail
  warn: "#ffd23f"    # status only: warn
  c1: "#ff2e93"      # chart series 1 to 4
  c2: "#4f9dff"
  c3: "#2ec4b6"
  c4: "#f5a524"

typography:
  # Files: assets/fonts/Geist-Variable.woff2 and assets/fonts/GeistMono-Variable.woff2.
  sans: { fontFamily: "Geist", weight: "100 900" }
  mono: { fontFamily: "Geist Mono", weight: "100 900" }
---

# arc-design, for a film

The look is the one every arc page and app uses. A film takes its colours and fonts from the
frontmatter above. Sizes, spacing and border weight are scaled for the screen.

## How the values reach the film

1. Declare each colour the film uses as a `color` variable in `data-composition-variables` on
   the `<html>` of `index.html`. The id is the key above: `bg`, `fg`, `hi`, `on-hi`. That
   attribute is the only place a colour literal appears.
2. Read them in every scene as `var(--bg)`, `var(--hi)`, `var(--on-hi)`.
3. Copy `Geist-Variable.woff2`, `GeistMono-Variable.woff2` and `OFL.txt` into `assets/fonts/`.
   Declare both families with `@font-face` in each file that uses them.
4. Write `font-family: "Geist"` or `font-family: "Geist Mono"`, by name, with no stack.

## Motion

- The ease is `cubic-bezier(.2,.7,.2,1)`. In GSAP: `CustomEase.create("arc", "0.2,0.7,0.2,1")`.
- An entrance takes 0.5 seconds.

## Do

- Fill the frame. The subject takes at least 40% of the frame's width or height.
- Use `hi` once per frame, on the thing the frame is about. Text on it is `on-hi`.
- Show real values and name their source on screen.
- Move things to show an order, a direction or a size.

## Don't

- No second accent. `ok`, `bad` and `warn` mark status only.
- No other typeface, and no font from a CDN.
- No blur, scramble or per-letter text effect. Text enters by opacity and position.
- No loop, grain, glow, glitch, aurora or camera shake as decoration.
