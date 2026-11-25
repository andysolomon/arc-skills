# Illustrations (opt-in)

Read this when the user asks for art, for the cover of a page they say they will present, or when an explanation's core idea has a gesture a Hairline figure can show. In every other case a page carries no illustration: pages are spec-like. One illustration per page, from one maker.

## First choice: a Hairline figure

`hairline` in the kit. An isometric line figure from the `hairline-create` skill ([lucasmarkes/hairline](https://github.com/lucasmarkes/hairline), MIT; `npx skills add lucasmarkes/hairline`). It shows one mechanism as an object the pointer acts on, and the page's tokens colour it, so it follows dark and light. Use it whenever the page's idea has a gesture: a funnel whose stage lifts, a rate limiter a burst can't pass, branches that check out.

- **Make it:** load `hairline-create` and follow its own workflow through its look (`look.mjs` exits 0, and you have read the sheet). With nobody to pick a concept, take the one with the strongest rest pose and say which. From the user's SVG, use `hairline-adopt`. If neither skill is installed, say so and fall back to a card (below).
- **Capture the still:** the figure runs on a script, so the page gets a frozen pose:

  ```sh
  node <skill-dir>/scripts/hairline.mjs --page hairline-<name>.html --slug <slug> \
    --title "<name>" --desc "<what the pose shows>" [--at x,y] --out <scratchpad>/<slug>.svg
  ```

  Without `--at` it takes the rest pose, which Hairline composes as the thumbnail; use that by default. With `--at` (the point `look.mjs` prints for `--answer`) it takes the figure answering, when that pose says more. It prefixes every id, adds the title and desc, prints the read-out, and warns past 80 KiB. Rest poses ran about 18 KiB. It loads `playwright-core` and the browser through `hairline-create`'s `look.mjs`; set `CHROME_PATH` when there is no Chrome.
- **Embed it:** copy the kit's `hairline` CSS block and put the svg inside `figure.hl > .plate` unchanged. The block maps the kernel's classes (`sil`, `hi`, `lo`, `dot`, `ghost`) to page tokens: never recolour the svg itself.
- **Link the live figure** in the `figcaption`, with an ordinary link: "Open the live figure". Publish `hairline-<name>.html` as a claude.ai Artifact (the Artifact tool), which runs its script. Artifacts start private: before the user shares the page, tell them to share the Artifact too, or its readers hit a sign-in wall. Never embed the live file, and never fake its tour with CSS: crossfading poses on a loop is decoration, not flow, and breaks the motion rules.
- **Caption:** the figure's name, "Hairline figure", and the link.

## Otherwise: a card

`spot` in the kit, when no gesture fits the idea or the user asks for a picture rather than a mechanism. Four styles from [MengTo/Skills](https://github.com/MengTo/Skills/tree/main/agent-skills/illustration) (MIT). Pick by subject, and prefer the two object styles: they generate their geometry with a kit, so there are no faces or hands to get wrong.

- `illustration-isometric-mono`: an isometric workspace on one slab, in one green ramp. Use it for architecture, infrastructure, pipelines and dev stacks.
- `illustration-teal-spot`: one hero object in a 3/4 view, teal on white. Use it for a single concept (a database, an inbox, a merge, a file).
- `illustration-line-interior`: a wide, airy room where small people work, in a thin indigo line with colour on under 7% of the card. Use it when the subject is people at work: a team, a workspace, remote work, a review.
- `illustration-halftone-line`: open black line with greys made of halftone dots, no colour at all. Use it for an editorial scene with one or two people, when the page wants a monochrome picture.
- **People need extra checks.** Line interior and Halftone line draw people. In the render-critique rounds, zoom on every head and hand, check the prop sits in the hand, and redraw anything that reads as a mannequin. If a figure still looks wrong after three rounds, switch to an object style.
- **Make it:** load the chosen skill and follow its own workflow, including its render-critique rounds. If it isn't installed, say so and skip the illustration. Never hand-draw a substitute.
- **Not the other ten.** One-line draws broken figures (a blank head, noodle arms, a prop that floats away from the hand), and the loud colour styles clash with the dark page. If the user names another MengTo style, use it for that page and say it is outside the usual four.
- **Embed it:** paste the card's `<svg>` into the kit's `spot` shell unchanged, except: replace its `aria-label` with a `<title>` and `<desc>` that use the card's id prefix, and drop the XML declaration. Give the figure its style's class, `class="spot teal-spot"` (or `isometric-mono`, `line-interior`, `halftone-line`). The kit's colour map for that style then recolours the card from the page tokens: it sits on the page surface, its accent turns pink, and it follows dark and light. Never edit the card's colours by hand. A style outside the four has no map and keeps its own colours. The template's `svg text` rule already skips `.spot`.
- **Check the colours:** preview the page in dark and light. A colour still in the artist's palette (a stray teal or green) means the card uses a shade the map doesn't name: add it to that style's map in the kit, not to the card.
- **Budget:** the skills' own example cards run 19 to 29 KB (line interior), 50 to 200 KB (teal spot), 140 to 220 KB (isometric mono) and 100 to 340 KB (halftone line, whose dots add up). Check the page with `postplan check`, and keep it within the 512 KiB budget; with a large card, cut detail from the card rather than content from the page.
- **Caption:** name the card and its style in a `figcaption`.
