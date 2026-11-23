---
name: arc-html-response
description: Answer with an HTML page instead of terminal prose. Use for replies that explain, compare, plan, review, recommend, or report finished work, or that have structure (steps, options, numbers, a flow). Renders inline in T3 Code and publishes keepable write-ups to Postplan as static, JavaScript-free pages with SVG/CSS charts, diagrams, and motion. Asks the user's own choices through the harness's native question dialog, not as typed codes. Routes requests that need state (a vote, a shared checklist, live numbers) to a Lakebed app instead. Skip for one-liners, yes/no, commands to copy, and clarifying questions.
---

# HTML response

The user reads pages better than terminal scrollback. When a reply has shape (steps, options, a comparison, a flow, numbers, evidence), make it a small HTML page, show it, and keep the chat reply to a line or two.

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
- **End reports of work with a packet**, whether you did the work or the user describes it as yours. Analyses of data, plans and explanations get no packet; delete the template's. The packet: revision, what changed, commands run and results, checks, open questions. With a `changes` table above it, the packet's changed line is just the total (`3 files, +83 −39`), and open items live only in its open line, not in a second list. Label every check with the literal word `PASS`, `FAIL`, or `NOT_RUN` (a review's `findings` may also use `WARN`), never prose like "not run yet", so the status can be scanned and grepped. A check only proves what it exercised; anything that wasn't run is `NOT_RUN`.
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
| An illustration, only when asked | `spot` (one card per page, see Illustrations) |

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
- Motion shows meaning: dashes flowing along an arrow show direction, bars growing show size, a stagger shows order, a panel fading in confirms that a tab or `<details>` opened. No decorative loops.
- Motion is optional. A page with no chart or diagram needs none.
- Reading order: never animate the headline or the lede, so the answer shows at once. One entrance moment per page, on the main chart or diagram; supporting rows may follow in a stagger. Put `class="still"` on any other chart so it doesn't animate. Feedback on tabs and `<details>` doesn't count as a moment.
- Use the template's timing tokens, not one-off numbers: `--t-micro` 160ms for hover, `--t-state` 220ms for a state change, `--t-enter` 500ms for entrances, `--stagger` 60ms between items.
- Put every animation inside `@media (prefers-reduced-motion: no-preference)`.
- Animate *from* the start state (`animation-fill-mode: backwards`), so a screenshot, a still frame, or reduced motion still shows the finished page.
- No scroll-driven animation (`animation-timeline: view()`). T3's frame sizes to the content and never scrolls, so the content stays invisible.
- Keep it under 1s, on `transform` and `opacity`, with the template's `--ease`.

## Illustrations (opt-in)

Pages are spec-like, so they carry no illustrations by default. Add one only when the user asks for art, or for the cover of a page they say they will present.

- **Where cards come from:** the `illustration-one-line` skill from [MengTo/Skills](https://github.com/MengTo/Skills/tree/main/agent-skills/illustration) (MIT). Load it and follow its own workflow, including its render-critique rounds. If it isn't installed, say so and skip the illustration. Never hand-draw a substitute.
- **One style, one card:** one-line only, one card per page, so pages stay consistent and light.
- **Embedding:** paste the card's `<svg>` into the kit's `spot` shell (`figure.spot`) unchanged, except: replace its `aria-label` with a `<title>` and `<desc>` that use the card's id prefix, and drop the XML declaration. Keep its own colours and fonts; the template's `svg text` rule already skips `.spot`.
- **Budget:** one-line cards run about 20 to 40 KB. Keep the whole page within the 512 KiB budget.
- **Caption:** name the card and its style in a `figcaption`.

## When a page isn't enough

A page is static: no script, no fetch, no forms. A request that needs state is an app, not a page: a vote or poll, a sign-up sheet, a shared checklist, live numbers, sign-in, anything one person types into and others see.

Still a page: a checklist the user prints or ticks off alone, numbers you already have, a plan or report about an app. Only reach for an app when people must write to it or see each other's changes.

- If the user asked for a page and it turns out to need state, say so in one line and confirm before building. If they asked for the app itself, build it. Either way, a deploy creates a public URL.
- **Lakebed first.** Build it as a Lakebed capsule, following [lakebed.md](lakebed.md): where the code goes, guests and caps, server-side permission checks, secrets that fail closed, a two-person test, and the hand-over (URL, expiry, claim). Report the URL, the checks you ran, and the expiry if the deploy is unclaimed.
- **Move to Cloudflare** (Workers with static assets, Durable Objects for state, an Alchemy stack) when the app outgrows Lakebed: it must not expire or must be production-ready, needs a custom domain or npm packages, or would pass Lakebed's free limits (10,000 requests and 1,000 writes a day per deploy, 1 MiB of stored data).
- Keep the write-up on Postplan and link the app with an ordinary link. A Postplan page can't embed or call it (no iframes, no fetch).

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
- **Dark first:** true black (`#000`) page, white text, dark gray only for secondary surfaces. Light mode via `prefers-color-scheme`.
- **One accent** (the template's pink) for emphasis. Green, red and yellow only for status (pass, fail, warn).
- Colors as tokens on `:root`. Don't name your own tokens after T3's theme variables (`--card`, `--muted`, `--accent`, `--border`…): `--card: var(--card, …)` is a cycle and silently breaks, and overriding them restyles the thread. Read T3's values as fallbacks instead, like the template's `--surface: var(--card, #0e0e11)`.
- Readable at 390px wide: single column under 720px, no horizontal page scroll, 16px side gutter. Give tables of three or more columns `class="stack-sm"` so rows stack on phones instead of squeezing.
- External links get `target="_blank" rel="noopener noreferrer"`.
- Numbers use tabular figures, body text stays near 65 characters a line, and long words wrap instead of widening the page. The template does all three.

## Check it

Run the lint from this skill's base directory, and fix every `FAIL` before showing or publishing:

```sh
bash <skill-dir>/scripts/lint.sh <file.html>
```

The lint enforces the contract plus the motion rules (scripts, `<link>`, handlers, blocked tags, local paths, size, animation without a reduced-motion guard, scroll-driven animation), fails any `<svg>` without a title and a desc, and warns on a missing page title or viewport and on em dashes. When diagram-design is installed it also runs that skill's `self_check.py --offline` on pages with an SVG.

Changing the skill itself? Run `bash <skill-dir>/tests/test-lint.sh` and `bash <skill-dir>/tests/test-chart.sh`, then the release gate in [tests/fresh-agent.md](tests/fresh-agent.md), which includes previewing the kit with worst-case data (`node <skill-dir>/tests/worst-case.mjs <out.html>`).

## Show it

**In T3 Code** (the `mcp__t3-code__html_preview` / `html_render` tools exist; load them with ToolSearch):
1. `html_preview` the file at width 728, and again at 390 with `appearance: "light"`. Fix overflow, cramped diagrams, or unreadable contrast. The screenshot can catch entrance animations mid-flight; a half-drawn bar in the preview is timing, not a bug.
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
