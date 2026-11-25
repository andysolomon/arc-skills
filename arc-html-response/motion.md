# Motion

Read this before writing an animation or a loop the kit doesn't have, or stopping a figure from moving. Motion on a page is CSS only. Filming a page is in [frames.md](frames.md).

- **The shared rules are `arc-design`'s** (its Motion section): motion shows meaning, the four timing tokens, every animation and transition inside the reduced-motion guard, the poster frame, entrances and state changes under 1s each. The template and the kit already follow them. Read that section now.
- **On a page, meaning looks like this:** bars growing show size, a line drawing shows a trend, a stagger shows order, units landing show a count, a note landing after the data shows the takeaway, dashes or a packet moving along a wire show direction, bars sliding when a switch flips show a change, a step lighting its part shows where you are.
- **Default to motion on the hero figure.** Every figure may enter, in reading order. Entrances play on load, so on Postplan a figure below the fold has finished before anyone scrolls to it: spend the most on the hero figure and on what responds to the reader (`steps`, `toggle`, `focus`, hover read-outs), which is always seen. Put `class="still"` on a figure that shouldn't move.
- **Loops show flow only:** flowing dashes or one `packet` per route, on a multiple of `--t-enter`, at most one loop per figure.
- **Reading order:** never animate the headline or the lede, so the answer shows at once.
- **No scroll-driven animation** (`animation-timeline: view()`). T3's frame sizes to the content, so the page inside it doesn't scroll and a scroll-driven entrance never plays.
