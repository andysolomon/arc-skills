---
name: arc-html-response
description: Answer with an HTML page instead of terminal prose. Use for replies that explain, compare, plan, review, recommend, or report finished work, or that have structure (steps, options, numbers, a flow). Renders inline in T3 Code and publishes keepable write-ups to Postplan as static, JavaScript-free pages with SVG/CSS charts, diagrams, and motion. Skip for one-liners, yes/no, commands to copy, and clarifying questions.
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
- **Lead with the answer.** The headline is the verdict or main point, not the topic. The first paragraph says what to do or what's true.
- **One idea per section.** A short `h2` that states the point, then the evidence.
- **Draw the mechanism, not decoration.** A visual earns its place only when it carries meaning: a flow, a chart of real numbers, a from → to table, a ranking, a stat with its denominator. No stock icons, no ornamental gradients.
- **Real data only.** Numbers, file paths, commands and results come from this session. Label anything illustrative as illustrative.
- **Plain words.** Short sentences. No jargon the user hasn't used. Name files by repo-relative path (`src/auth/session.ts`).
- **End reports of work with a packet:** revision, what changed, commands run and results, checks, open questions. Label every check with the literal word `PASS`, `FAIL`, or `NOT_RUN`, never prose like "not run yet", so the status can be scanned and grepped. A check only proves what it exercised; anything that wasn't run is `NOT_RUN`.
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

Open [components.html](components.html) and copy the blocks you need. Each block is marked `/* component: name */` in the CSS and `<!-- component: name -->` in the markup, and already follows the contract. For a part the kit lacks, build it from the page tokens. (Maintainers: a part joins the kit once it has been hand-built on two pages. Diagram types never do; they stay in diagram-design.)

| Need | Component |
|---|---|
| Compare values | `bars` (CSS bars, value in `--v`), `stacked` |
| Trend over time | `line` (SVG polyline) |
| Share of a whole | `donut` (one circle, `stroke-dasharray`) |
| Headline numbers | `stats` (number plus its denominator) |
| Density by two keys | `heat` (CSS grid, `color-mix()`) |
| A straight line of steps | `flow` (wide SVG plus a stacked phone SVG) |
| Forks, architecture, anything else | `diagram` (the shell for diagram-design output) |
| Sequence of events | `timeline` |
| Options side by side | `compare` (table) |
| Review or audit results | `findings` (literal status word first) |
| Files the work touched | `changes` (table, above the packet) |
| A choice the user must make | `decisions` (numbered questions, lettered options, one pick) |
| Views of one thing | `tabs` (radio and label, no script) |
| Evidence and raw data | `details` |

Charts:
- Plot real numbers from this session. Compute SVG coordinates while writing the page; show the scale (axis labels or a value on each mark).
- Every `<svg>` gets `role="img"`, a `<title>` and a `<desc>`, with ids prefixed by a slug (`aria-labelledby="deploy-title deploy-desc"`). CSS charts get `role="img"` and an `aria-label`. Put the raw numbers in a `<details>` table under the chart.
- For chart form and color choices, load the `dataviz` skill when it is available.
- A chart the kit lacks (waterfall, scatter, Sankey, Gantt, radar, treemap) goes to `diagram-design` under the same overrides as a diagram, below. Without that skill, use the closest kit chart or a table.

Diagrams:
- **A straight line of five steps or fewer, no forks:** the kit's `flow`.
- **Anything else** (a fork, an architecture, a sequence, a state machine, a schema): if the `diagram-design` skill is available, load it and let it choose the type, the layout and what to cut. Follow its type reference, complexity budget, connector rules and taste gate, with these overrides so the result fits this page:
  - **Style guide:** read [diagram-profile.md](diagram-profile.md) directly as the effective style guide. Don't `load` or `switch` it (that overwrites the user's own skin), and skip the first-run style gate.
  - **Output:** no standalone file. Write the `<svg>` into the page inside the kit's `diagram` shell (`.dd-wrap` > `svg.dd`), using the shell's classes and page tokens instead of hex colors, so one SVG serves dark and light. The profile lists the role-to-token map.
  - **Size:** viewBox 680 wide (720 at most), with `min-width` equal to that width. Type: names 13px sans 600, sublabels 11px mono, arrow labels 10px mono capitals.
  - **Fonts:** system stacks only. No font `<link>`.
  - **Motion:** modes `none`, `loop`, or CSS-only `reveal`. Never `step`; it needs a script.
  - **No pause:** skip its confirm-before-drawing question. Name the diagram type and anything you cut in the section text instead.
- **Without diagram-design:** use the `diagram` shell and its rules by hand (right-angle elbows, arrows drawn before boxes, a masked label on every branch, names in sans and mono only for technical sublabels, one accent path, 9 nodes at most), or split the idea into two simpler figures.
- **Mermaid, draw.io, Excalidraw sources:** never embed them live or paste a renderer's layout. With diagram-design, use its import (it redraws and reports what it merged or dropped). Without it, redraw by hand in the `diagram` shell.

Motion (CSS only):
- Motion shows meaning: dashes flowing along an arrow show direction, bars growing show size, a stagger shows order. No decorative loops.
- Put every animation inside `@media (prefers-reduced-motion: no-preference)`.
- Animate *from* the start state (`animation-fill-mode: backwards`), so a screenshot, a still frame, or reduced motion still shows the finished page.
- No scroll-driven animation (`animation-timeline: view()`). T3's frame sizes to the content and never scrolls, so the content stays invisible.
- Keep it under 1s, on `transform` and `opacity`, with the template's `--ease`.

## Design

The template sets this up:
- **Spec-like, not a landing page.** A plain headline sized as a heading, not a hero. Tables and lists over decorative card chrome. No marketing voice, no em dashes.
- **Dark first:** true black (`#000`) page, white text, dark gray only for secondary surfaces. Light mode via `prefers-color-scheme`.
- **One accent** (the template's pink) for emphasis. Green, red and yellow only for status (pass, fail, warn).
- Colors as tokens on `:root`. Don't name your own tokens after T3's theme variables (`--card`, `--muted`, `--accent`, `--border`…): `--card: var(--card, …)` is a cycle and silently breaks, and overriding them restyles the thread. Read T3's values as fallbacks instead, like the template's `--surface: var(--card, #0e0e11)`.
- Readable at 390px wide: single column under 720px, no horizontal page scroll, 16px side gutter. Give tables of three or more columns `class="stack-sm"` so rows stack on phones instead of squeezing.
- External links get `target="_blank" rel="noopener noreferrer"`.

## Check it

Run the lint from this skill's base directory, and fix every `FAIL` before showing or publishing:

```sh
bash <skill-dir>/scripts/lint.sh <file.html>
```

It enforces the contract plus the motion rules (scripts, `<link>`, handlers, blocked tags, local paths, size, unguarded `@keyframes`, scroll-driven animation), fails any `<svg>` without a title and a desc, and warns on a missing page title or viewport and on em dashes. When diagram-design is installed it also runs that skill's `self_check.py --offline` on pages with an SVG.

## Show it

**In T3 Code** (the `mcp__t3-code__html_preview` / `html_render` tools exist; load them with ToolSearch):
1. `html_preview` the file at width 728, and again at 390 with `appearance: "light"`. Fix overflow, cramped diagrams, or unreadable contrast. The screenshot can catch entrance animations mid-flight; a half-drawn bar in the preview is timing, not a bug.
2. `html_render` it with the `contentHeight` from the preview (capped at 2000; content past that scrolls). For inline rendering, delete the template's `/* standalone */` block: the thread supplies the background and the side gutter. The template's `var(--foreground, …)` fallbacks pick up T3's theme.
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

Outside T3 Code with no render tool, publish to Postplan and give the link.

## The chat reply

After the page is shown or published, the reply is at most three sentences, caveats included: the main point in plain words, the link (if published) or the file path, and what wasn't verified or needs the user's decision. The comparison, options, and details live on the page; never paste them back into chat.
