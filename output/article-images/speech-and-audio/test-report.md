# Live skill trial

Result: four PNG cards rendered and visually inspected at 1080 × 1350 and 390 px width. This was an end-to-end manual trial, not a model-graded evaluation-suite run.

- Source access: PASS. Read the requested overview and three linked lessons.
- Source fidelity: PASS for selected claims. No source model rankings, benchmark figures, or universal architecture claims were reused.
- Rendering: PASS. Built-in image generation produced the original cover art; SVG typesetting and resvg produced the final cards.
- Artifact checks: PASS. Four full-size PNGs and four phone-size review PNGs exist. Editable SVGs, render source, prompt, storyboard, and source notes accompany them.
- Visual review: PASS. Opened all four full-size and all four phone-size cards. Essential headings, relationships, and takeaways are readable, with no observed clipping or overlap. Metadata is deliberately small.
- Semantic repair: fixed the initial filtering schematic to preserve the low-frequency component through filtering and sampling. Reopened the corrected card at both sizes.
- Skill improvement: added a transformation-consistency check to the production reference, based on this observed failure.

Reproduce with `bun install` and `bun run render` in this directory. The renderer uses Arial, Georgia, and Courier New from the local system; other machines may require equivalent fonts or path adjustments. Fonts are not redistributed. The generated cover artwork is already included.

`preview.png` is a contact sheet. The four numbered PNG files are the full-resolution deliverables. Phone-size PNGs are review artifacts.
