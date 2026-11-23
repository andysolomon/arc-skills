---
name: arc-html-response
description: Answer with an HTML page instead of terminal prose. Use for replies that explain, compare, plan, review, recommend, or report finished work, or that have structure (steps, options, numbers, a flow). Renders inline in T3 Code and publishes keepable write-ups to Postplan as static, JavaScript-free pages with SVG/CSS charts, diagrams, and motion. Shows a product UI as a still when a page is about an interface (a screenshot of our own app, or a Stageshow capture). Asks the user's own choices through the harness's native question dialog, not as typed codes. Routes requests that need state (a vote, a shared checklist, live numbers) to a Lakebed app instead. Skip for one-liners, yes/no, commands to copy, and clarifying questions.
---

# HTML response

The user reads pages better than terminal scrollback. When a reply has shape (steps, options, a comparison, a flow, numbers, evidence), make it a small HTML page, show it, and keep the chat reply to a line or two.

This is the base layer under `arc-design`, which holds the look every layer shares and routes a request that needs a lasting app to `arc-web-production`.

## Decide: page or plain text?

Make a page when the reply is any of:
- an explanation, how/why answer, or walkthrough
- a comparison, trade-off, or recommendation
- a plan, proposal, or opinion piece
- a review, audit, or findings list
- a report of finished work (what changed, what was checked, what's open)
- anything with a table, a chart, a diagram, a before/after, or more than ~5 bullet points

Stay in plain text when the reply is:
- one or two sentences, a yes/no, or a single fact
- a command, path, or snippet the user will copy
- a clarifying question or a quick progress note mid-task
- the user said "in chat", "just tell me", or "short answer"

When unsure, make the page. It costs little and reads better.

## Write the page

Start from [template.html](template.html), next to this file; open it with your file-read tool. Write the file to the scratchpad (or the location the user names), e.g. `<scratchpad>/<topic-slug>/index.html`.

Content:
- **Kicker:** the small line above the headline names the project and topic in a few words (`arc-skills · auth`).
- **Lead with the answer.** The headline is the verdict or main point, not the topic. The first paragraph says what to do or what's true.
- **One idea per section.** A short `h2` that states the point, then the evidence.
- **Draw the mechanism, not decoration.** A visual earns its place only when it carries meaning: a flow, a chart of real numbers, a from → to table, a ranking, a stat with its denominator. No stock icons, no ornamental gradients.
- **Real data only.** Numbers, file paths, commands and results come from this session. Numbers derived from them (a total, a projected saving) are fine if the page shows the arithmetic or calls them estimates. Label anything illustrative as illustrative. Write dates as absolute dates, never "3 days ago", and only when you know them. A value you don't have is written as unknown ("revision: unknown", "exact command not recorded"), never invented.
- **Plain words.** Short sentences. No jargon the user hasn't used. Name files by repo-relative path (`src/auth/session.ts`).
- **End reports of work with a packet**, whether you did the work or the user describes it as yours. Analyses of data, plans and explanations get no packet; delete the template's. The packet: revision, what changed, commands run and results, checks, open questions. With a `changes` table above it, the packet's changed line is just the total (`3 files, +83 −39`), and open items live only in its open line, not in a second list. Several commands go as a list under the one evidence key. Give each check its own line, worst first (`FAIL`, then `NOT_RUN`, then `PASS`), and make the section's heading the tally in the same order (`Checked: 1 FAIL, 2 NOT_RUN, 5 PASS`). Label every check with the literal word `PASS`, `FAIL`, or `NOT_RUN` (a review's `findings` may also use `WARN`), never prose like "not run yet", so the status can be scanned and grepped. Write the packet in plain words, with `<code>` only around literal values (a revision, a command, a path). A check only proves what it exercised; anything that wasn't run is `NOT_RUN`.
- **Keep it short.** Most pages are 3–6 sections. Cut anything the user won't act on.

## The Postplan contract

Every page follows Postplan 0.0.4's rules, even pages that are only rendered in T3. One static page then looks the same inline in T3, on Postplan, and when another agent fetches it raw.

- **No JavaScript.** No `<script>` (inline or `src`), no `on*=` handler attributes, no `javascript:` URLs. Postplan rejects `<script src>` at upload and serves pages with `script-src 'none'`, so inline scripts never run either. Charts, tabs and motion are SVG and CSS.
- **One inline `<style>`.** No `<link>` (blocked tag), no `@import`, no `@font-face` or web fonts (CSP `default-src 'none'`). Use the template's system font stacks.
- **No forms, iframes, embeds, objects, `<base>`, or meta refresh.** `<input>` and `<label>` outside a `<form>` are fine (the kit's tabs use them).
- **Images from `https:` or `data:` only.** A local `chart.png` will not load.
- **Budget 512 KiB per page**, the 0.0.4 server default. `postplan check` reports the real limit for the account.
- **Nothing private.** No secrets, tokens, private URLs, or absolute local paths (`/home/…`, `/Users/…`, `/tmp/…`, the scratchpad). Postplan links are viewable by anyone who has them.

## Charts, diagrams, and motion

Build the page from [template.html](template.html), which holds every shared token and base rule, then open [components.html](components.html) and copy the blocks you need. Each block is marked `/* component: name */` in the CSS and `<!-- component: name -->` in the markup, and already follows the contract. Delete template blocks you don't use (the `.row` before/after rows, the packet). For a part the kit lacks, build it from the page tokens. (Maintainers: a part joins the kit once it has been hand-built on two pages. Diagram types never do; they stay in diagram-design.)

| Need | Component |
|---|---|
| Compare values | `bars` (CSS bars, value in `--v`), `stacked` |
| Trend over time | `line` (SVG polyline) |
| Share of a whole | `donut` (one circle, `stroke-dasharray`) |
| Headline numbers | `stats` (a number with its denominator, or its unit when it has none) |
| Density by two keys | `heat` (CSS grid, `color-mix()`) |
| A straight line of steps | `flow` (wide SVG plus a stacked phone SVG) |
| Forks, architecture, anything else | `diagram` (the shell for diagram-design output) |
| Sequence of events | `timeline` |
| Options side by side | `compare` (table) |
| Review or audit results | `findings` (literal status word first) |
| Files the work touched | `changes` (table, above the packet) |
| A choice the user must make | `decisions` (numbered questions, lettered options, recommended first), then ask in the dialog (see When the user must choose) |
| Views of one thing | `tabs` (radio and label, no script) |
| Evidence and raw data | `details` |
| An illustration, only when asked | `hairline` (a captured Hairline figure, first choice) or `spot` (one card), one per page, see Illustrations |
| A product UI, only when the page is about one | `stage` (one captured Stageshow still per page, see Product UI stills) |

Charts:
- Plot real numbers from this session. Don't compute coordinates by hand: [scripts/chart.mjs](scripts/chart.mjs) prints ready markup for `bars` (scaled widths, an aria-label, a raw-numbers table), `line` (nice axis ticks, title, desc, a raw-numbers table) and `donut` (title, desc, the share with its denominator). It prints markup only, so also copy the matching CSS block from the kit. `node <skill-dir>/scripts/chart.mjs --help` lists every flag. Show the scale (axis labels or a value on each mark).
- `stats` or `donut`? A single share with a small denominator ("3 of 40 runs") reads better as a `stats` tile. Use a donut when the share itself is the headline.
- Every `<svg>` gets `role="img"`, a `<title>` and a `<desc>`, with ids prefixed by a slug (`aria-labelledby="deploy-title deploy-desc"`). CSS charts get `role="img"` and an `aria-label`. Put the raw numbers in a `<details>` table under the chart.
- For chart form and color choices, load the `dataviz` skill when it is available.
- A chart the kit lacks (waterfall, scatter, Sankey, Gantt, radar, treemap) goes to `diagram-design` under the same overrides as a diagram, below. Without that skill, use the closest kit chart or a table.

Diagrams:
- **A straight line of five steps or fewer, no forks:** the kit's `flow`.
- **Anything else** (a fork, an architecture, a sequence, a state machine, a schema): if the `diagram-design` skill is available, load it and let it choose the type, the layout and what to cut. Follow its type reference, complexity budget, connector rules and taste gate, with these overrides so the result fits this page:
  - **Style guide:** read [diagram-profile.md](diagram-profile.md) directly as the effective style guide; its first paragraph says which parts apply. Don't run diagram-design's `load` or `switch` profile commands (they overwrite the user's own skin), and skip its first-run style gate.
  - **Who wins:** diagram-design decides the type, layout, what to cut, connector routing and the complexity budget. The kit's `diagram` shell decides the markup: its classes, markers and stroke widths, and its sizes below.
  - **Output:** no standalone file. Write the `<svg>` into the page inside the kit's `diagram` shell (`.dd-wrap` > `svg.dd`), using the shell's classes and page tokens instead of hex colors, so one SVG serves dark and light. The profile lists the role-to-token map.
  - **Size:** viewBox 680 wide (720 at most), with `min-width` equal to that width. Type: names 13px sans 600, sublabels 11px mono, arrow labels 10px mono capitals.
  - **Legend:** only when the diagram uses two or more kinds of node or line. Put it in a bottom strip inside the viewBox, above a `.rule` line, with `.legend` text.
  - **Fonts:** system stacks only. No font `<link>`.
  - **Motion:** modes `none`, `loop`, or CSS-only `reveal`. Never `step`; it needs a script.
  - **No pause:** skip its confirm-before-drawing question. If you cut something from the user's description, say what in plain words in the section text ("The retry path is left out."). Don't describe the diagram itself.
  - **Unchecked rules:** the installed diagram-design has no `verify-geometry.py`, so check connector rules 2 (label gap), 4 (separate attach points) and 6 (mask before node) by eye in the preview.
- **Without diagram-design:** use the `diagram` shell and its rules by hand (right-angle elbows, arrows drawn before boxes, a masked label on every branch, names in sans and mono only for technical sublabels, one accent path, 9 nodes at most), or split the idea into two simpler figures.
- **Mermaid, draw.io, Excalidraw sources:** never embed them live or paste a renderer's layout. With diagram-design, use its import (it redraws and reports what it merged or dropped). Without it, redraw by hand in the `diagram` shell.

Motion (CSS only):
- **The shared rules are `arc-design`'s** (its Motion section): motion shows meaning, the four timing tokens, every animation and transition inside the reduced-motion guard, the poster frame, `transform` and `opacity` under 1s each. The template and the kit already follow them. Read that section before writing an animation the kit doesn't have.
- On a page, meaning looks like this: dashes flowing along an arrow show direction, bars growing show size, a stagger shows order, a panel fading in confirms that a tab or `<details>` opened.
- Motion is optional. A page with no chart or diagram needs none.
- Reading order: never animate the headline or the lede, so the answer shows at once. One entrance moment per page, on the main chart or diagram; supporting rows may follow in a stagger. Put `class="still"` on any other chart so it doesn't animate. Feedback on tabs and `<details>` doesn't count as a moment.
- No scroll-driven animation (`animation-timeline: view()`). T3's frame sizes to the content and never scrolls, so the content stays invisible.
- **Rehearse it.** A page with an entrance gets filmed before it is shown. `node <skill-dir>/scripts/frames.mjs <file.html> --select "<main visual>"` writes `<file>.frames.html` next to it: the page frozen at 0, 120, 240, 360 and 500 ms, then the poster, each frame labelled with what is moving. `html_preview` that one file at the width the script prints, and read every frame: the stagger runs in order, nothing jumps between frames, and the poster holds up alone. A label in red means one animation runs past 1s. The sheet runs a script to freeze the frames, so it is for preview only: never render, lint or publish it. (Also from Stageshow, which films every demo as a contact sheet before handing it over.)

## Illustrations (opt-in)

Pages are spec-like, so they carry no illustrations by default. Add one only when the user asks for art, or for the cover of a page they say they will present. One illustration per page, from one maker.

**First choice: a Hairline figure** (`hairline` in the kit). An isometric line figure from the `hairline-create` skill ([lucasmarkes/hairline](https://github.com/lucasmarkes/hairline), MIT; `npx skills add lucasmarkes/hairline`). It shows one mechanism as an object the pointer acts on, and the page's tokens colour it, so it follows dark and light. Use it whenever the page's idea has a gesture: a funnel whose stage lifts, a rate limiter a burst can't pass, branches that check out.

- **Make it:** load `hairline-create` and follow its own workflow through its look (`look.mjs` exits 0, and you have read the sheet). With nobody to pick a concept, take the one with the strongest rest pose and say which. From the user's SVG, use `hairline-adopt`. If neither skill is installed, say so and fall back to a card (below).
- **Capture the still:** the figure runs on a script, so the page gets a frozen pose:

  ```sh
  node <skill-dir>/scripts/hairline.mjs --page hairline-<name>.html --slug <slug> \
    --title "<name>" --desc "<what the pose shows>" [--at x,y] --out <scratchpad>/<slug>.svg
  ```

  Without `--at` it takes the rest pose, which Hairline composes as the thumbnail; use that by default. With `--at` (the point `look.mjs` prints for `--answer`) it takes the figure answering, when that pose says more. It prefixes every id, adds the title and desc, prints the read-out, and warns past 80 KiB. Rest poses ran about 18 KiB. It loads `playwright-core` and the browser through `hairline-create`'s `look.mjs`; set `CHROME_PATH` when there is no Chrome.
- **Embed it:** copy the kit's `hairline` CSS block and put the svg inside `figure.hl > .plate` unchanged. The block maps the kernel's classes (`sil`, `hi`, `lo`, `dot`, `ghost`) to page tokens: never recolour the svg itself.
- **Link the live figure** in the `figcaption`, with an ordinary link: "Open the live figure". Publish `hairline-<name>.html` as a claude.ai Artifact (the Artifact tool), which runs its script. Artifacts start private: before the user shares the page, tell them to share the Artifact too, or its readers hit a sign-in wall. Never embed the live file, and never fake its tour with CSS: crossfading poses on a loop breaks the motion rules (each animation under 1s, one entrance moment).
- **Caption:** the figure's name, "Hairline figure", and the link.

**Otherwise: a card** (`spot` in the kit), when no gesture fits the idea or the user asks for a picture rather than a mechanism. Four styles from [MengTo/Skills](https://github.com/MengTo/Skills/tree/main/agent-skills/illustration) (MIT). Pick by subject, and prefer the two object styles: they generate their geometry with a kit, so there are no faces or hands to get wrong.

- `illustration-isometric-mono`: an isometric workspace on one slab, in one green ramp. Use it for architecture, infrastructure, pipelines and dev stacks.
- `illustration-teal-spot`: one hero object in a 3/4 view, teal on white. Use it for a single concept (a database, an inbox, a merge, a file).
- `illustration-line-interior`: a wide, airy room where small people work, in a thin indigo line with colour on under 7% of the card. Use it when the subject is people at work: a team, a workspace, remote work, a review.
- `illustration-halftone-line`: open black line with greys made of halftone dots, no colour at all. Use it for an editorial scene with one or two people, when the page wants a monochrome picture.
- **People need extra checks.** Line interior and Halftone line draw people, which is where one-line failed. In the render-critique rounds, zoom on every head and hand, check the prop sits in the hand, and redraw anything that reads as a mannequin. If a figure still looks wrong after three rounds, switch to an object style.
- **Make it:** load the chosen skill and follow its own workflow, including its render-critique rounds. If it isn't installed, say so and skip the illustration. Never hand-draw a substitute.
- **Not the other ten.** One-line failed on its figure: a blank head, noodle arms, a prop that floated away from the hand. The loud colour styles clash with the dark page. If the user names another MengTo style, use it for that page and say it is outside the usual four.
- **Embed it:** paste the card's `<svg>` into the kit's `spot` shell unchanged, except: replace its `aria-label` with a `<title>` and `<desc>` that use the card's id prefix, and drop the XML declaration. Give the figure its style's class, `class="spot teal-spot"` (or `isometric-mono`, `line-interior`, `halftone-line`). The kit's colour map for that style then recolours the card from the page tokens: it sits on the page surface, its accent turns pink, and it follows dark and light. Never edit the card's colours by hand. A style outside the four has no map and keeps its own colours. The template's `svg text` rule already skips `.spot`.
- **Check the colours:** preview the page in dark and light. A colour still in the artist's palette (a stray teal or green) means the card uses a shade the map doesn't name: add it to that style's map in the kit, not to the card.
- **Budget:** the skills' own example cards run 19 to 29 KB (line interior), 50 to 200 KB (teal spot), 140 to 220 KB (isometric mono) and 100 to 340 KB (halftone line, whose dots add up). Check the page with `postplan check`, and keep it within the 512 KiB budget; with a large card, cut detail from the card rather than content from the page.
- **Caption:** name the card and its style in a `figcaption`.

## Product UI stills (opt-in)

A page about an interface (a report on a UI change, a design proposal, a feature walkthrough) may show one still of that interface. Like an illustration it is opt-in: add one only when the page's subject is a UI or the user asks for one.

- **One of our own apps:** a still of an app we built (with `arc-web-production`) is a screenshot of the real, running app, not a Stageshow build. Shoot it at the width it is shown at, in the page's dark theme (add a light shot only when the light look matters), with real data. Headless Chromium driven by Playwright works. Embed it as an `<img>` with a `data:` PNG source and `alt` text that says what it shows, and name the width and theme in a `figcaption`. Shots at 390 and 728 px ran 10 to 25 KB each.
- **Any other interface** (one that doesn't exist yet, or isn't ours): stills come from the `stageshow` skill ([benjitaylor/skills](https://github.com/benjitaylor/skills/tree/main/stageshow), MIT; `npx skills add benjitaylor/skills --skill stageshow`). Load it and follow its own workflow through its rehearsal (`film.mjs --gate`, ending in `rehearsal passed`). Build a still, or a demo with a `poster`: the poster is the frame that gets captured. If it isn't installed, say so and skip the still. Never hand-build a faux UI.
- **Capture:** Stageshow's output is a React component, which a page can't run, so [scripts/stage.mjs](scripts/stage.mjs) renders it in headless Chrome and copies out the laid-out result. Start Stageshow's playground (`npm run dev` in its folder; it needs `npm install` there first), or the host app's own route, then:

  ```sh
  node <skill-dir>/scripts/stage.mjs --stageshow <stageshow-dir> \
    --url "<playground>/?capture=<example>&still=1" --slug <slug> \
    --label "<what the still shows>" --theme both --out <scratchpad>/<slug>
  ```

  It writes `<slug>.css` and `<slug>.html`: the DOM with only the CSS rules it uses (Stageshow's `@layer` kept), scoped to `.stage-<slug>`, local images inlined as `data:` URIs, icons marked `aria-hidden`, no script. It needs Chrome (`CHROME_PATH`, else the installed Chrome) and loads `playwright-core` from the stageshow folder. `--help` lists every flag.
- **Embedding:** copy the kit's `stage` CSS block, paste `<slug>.css` after it inside the page's one `<style>`, and put `<slug>.html` where the still goes. Don't edit the captured markup: change the still in Stageshow and capture it again.
- **Fit:** the size follows the frame's own width (a container query), so one still fits T3's thread and a full-width Postplan page. It steps the zoom down to 75% before it swaps to the compact design. `--theme both` captures the light and dark themes and swaps them with the page's color scheme. A still with no compact design scrolls inside its frame on phones. The script warns when this happens; give the still a compact design in Stageshow (Stageshow asks for one anyway).
- **Budget:** with both themes and both sizes, Stageshow's `static-card` came to 35 KiB and `hero-demo` to 71 KiB. The script prints the size and warns past 150 KiB.
- **Caption:** `--label` becomes both the frame's `aria-label` and its `figcaption`. A still is illustrative: its names and numbers are filler unless you put real ones in, so say so in the label ("Illustrative: …").
- **Stills only:** one per page, and it doesn't move. A demo with a moving cursor goes off the page (see When a page isn't enough). The kit's `stage` shell and the 150 KiB warning apply to Stageshow captures; a screenshot needs neither.

## When a page isn't enough

A page is static: no script, no fetch, no forms. A request that needs state is an app, not a page: a vote or poll, a sign-up sheet, a shared checklist, live numbers, sign-in, anything one person types into and others see.

Still a page: a checklist the user prints or ticks off alone, numbers you already have, a plan or report about an app. Only reach for an app when people must write to it or see each other's changes.

- If the user asked for a page and it turns out to need state, say so in one line and confirm before building. If they asked for the app itself, build it. Either way, a deploy creates a public URL.
- **Lakebed first.** Build it as a Lakebed capsule, following [lakebed.md](lakebed.md): where the code goes, guests and caps, server-side permission checks, secrets that fail closed, a two-person test, and the hand-over (URL, expiry, claim). Report the URL, the checks you ran, and the expiry if the deploy is unclaimed.
- **Move to `arc-web-production`** (a Foldkit app on Cloudflare: a Worker with static assets, Durable Objects for state, an Alchemy stack) when the app outgrows Lakebed: it must not expire or must be production-ready, needs a custom domain or npm packages, or would pass Lakebed's free limits (10,000 requests and 1,000 writes a day per deploy, 1 MiB of stored data).
- Keep the write-up on Postplan and link the app with an ordinary link. A Postplan page can't embed or call it (no iframes, no fetch).
- **An animated product demo** (a Stageshow demo with its cursor, or any React component) needs a script, so it never goes on a page, not even rebuilt as CSS keyframes. Put its poster on the page as a still (see Product UI stills) and link the running demo with an ordinary link. It needs npm packages, so host its built files the way `arc-web-production` deploys (its `references/deploy.md`: a Worker with static assets in an Alchemy stack). It stays a React demo; don't rebuild it as a Foldkit app. Confirm before deploying it.

## When the user must choose

The page can't take an answer: a card, button, or CSS radio on it never reaches you. So the page explains the choice and the harness's own question dialog collects it (`AskUserQuestion` in Claude Code, which T3 Code shows as tappable options).

- **On the page:** the `decisions` block is the record. Give each option its trade-off, put the recommended option first as A, and say why. It must still read on its own on Postplan, where there's no dialog.
- **Then ask:** after the page is rendered and the short reply is written, make the dialog your last call. Ask the same questions with the same option names as the page's bold names, the recommended one first with "(Recommended)" at the end of its label. Write each question so it stands alone: the dialog may cover the page. Don't add an "Other" option; the dialog adds one for typed answers.
- **Act on the answer** in the same turn. Don't stop to repeat the choices back.
- **Limits:** at most 4 questions with 2 to 4 options each. With more, ask the ones that block the next step and leave the rest on the page.
- **No dialog tool** (another harness): end the reply with "Answer like 1A, 2B."
- A choice for several people (a vote, a team pick) needs shared state: see When a page isn't enough.

## Design

The template sets this up:
- **Spec-like, not a landing page.** A plain headline sized as a heading, not a hero. Tables and lists over decorative card chrome. No marketing voice, no em dashes.
- **The look is `arc-design`'s:** dark first, one pink accent, green, red and yellow for status only, system fonts. The template's token block holds its values, and `node <arc-design>/scripts/check-tokens.mjs <page.html>` checks a page still matches. Don't change a token's value on a page.
- Colors as tokens on `:root`. Don't name your own tokens after T3's theme variables (`--card`, `--muted`, `--accent`, `--border`…): `--card: var(--card, …)` is a cycle and silently breaks, and overriding them restyles the thread. Read T3's values as fallbacks instead, like the template's `--surface: var(--card, #0e0e11)`.
- Readable at 390px wide: single column under 720px, no horizontal page scroll, 16px side gutter. Give tables of three or more columns `class="stack-sm"` so rows stack on phones instead of squeezing.
- External links get `target="_blank" rel="noopener noreferrer"`.
- Numbers use tabular figures, body text stays near 65 characters a line, and long words wrap instead of widening the page. The template does all three.

## Check it

Run the lint from this skill's base directory, and fix every `FAIL` before showing or publishing:

```sh
bash <skill-dir>/scripts/lint.sh <file.html>
```

The lint enforces the contract plus the motion rules (scripts, `<link>`, handlers, blocked tags, local paths, size, animation without a reduced-motion guard, scroll-driven animation), fails any `<svg>` without a title and a desc, and warns on a missing page title or viewport and on em dashes. When diagram-design is installed it also runs that skill's `self_check.py --offline` on pages with an accessible SVG (one not marked `aria-hidden`, so a captured still's icons alone don't trigger it).

Changing the skill itself? Run `bash <skill-dir>/tests/test-lint.sh`, `bash <skill-dir>/tests/test-chart.sh` and `bash <skill-dir>/tests/test-capture.sh`, then the release gate in [tests/fresh-agent.md](tests/fresh-agent.md), which includes previewing the kit with worst-case data (`node <skill-dir>/tests/worst-case.mjs <out.html>`).

## Show it

**In T3 Code** (the `mcp__t3-code__html_preview` / `html_render` tools exist; load them with ToolSearch):
1. `html_preview` the file at width 728, and again at 390 with `appearance: "light"`. Fix overflow, cramped diagrams, or unreadable contrast. The screenshot can catch entrance animations mid-flight; a half-drawn bar in the preview is timing, not a bug. The frame check (see Motion) shows the motion itself.
2. `html_render` it with the `contentHeight` from the preview (capped at 2000; content past that scrolls). Write the page once with the template's `/* standalone */` block: that file is the one to publish. For the inline render, render a copy with that block deleted (`inline.html` next to it), because the thread supplies the background and the side gutter. The template's `var(--foreground, …)` fallbacks pick up T3's theme.
3. Don't restate the page in the reply.

**Publish to Postplan** when the page is a write-up, report, plan, opinion, or anything the user may keep, revisit, or share, or when they ask for a link (global instructions: HTML write-ups and reports go to Postplan). If the user says they will send, share, post, or present it, publishing is required: a local file path can't be sent to a team. Save to any path they name *and* publish. Keep the `/* standalone */` block for Postplan pages.

The CLI is pinned to 0.0.6, the first version with `check` and `upload --json`:

```sh
cd ~ && npx -y postplan@0.0.6 check <file.html>
cd ~ && npx -y postplan@0.0.6 upload <file.html> --new --description "<one sentence>" --json
# later edits to the same page:
cd ~ && npx -y postplan@0.0.6 upload <file.html> --draft <draftId> --json
```

`check` must print `Ready.` The page is published only when the receipt says `"ok": true`; report its `url`. Read the exit code directly; don't pipe the upload through `tail` or `head`. A runner failure (no npx, registry DNS errors) is not a Postplan failure: say which it was.

Outside T3 Code with no render tool, publish to Postplan and give the link. Whenever you didn't preview the page, say the phone layout is unverified: the lint can't check layout.

## The chat reply

After the page is shown or published, the reply is at most three sentences, caveats included: the main point in plain words, the link (if published) or the file path, and what wasn't verified or needs the user's decision. The comparison, options, and details live on the page; never paste them back into chat. When the user must choose, the question dialog follows the reply (see When the user must choose); don't ask them to type codes when the dialog exists.
