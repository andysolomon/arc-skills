---
name: arc-html-response
description: Answers with an HTML page instead of terminal prose. Use when a reply explains, compares, plans, reviews, recommends or reports finished work, or has structure (steps, options, numbers, a flow), and when the user asks for a page, write-up, report, chart or diagram. Covers static pages for T3 Code and Postplan, a scripted rung for a click CSS can't handle (a strict Back-and-Next walk, a sortable table), choices asked through the harness's question dialog, and requests that need shared state (a vote, a shared checklist, live numbers), which it routes to a Lakebed app. Skip for one-liners, yes/no answers, commands to copy, and clarifying questions.
---

# HTML response

The user reads pages better than terminal scrollback. When a reply has shape (steps, options, a comparison, a flow, numbers, evidence), make it a small HTML page, show it, and keep the chat reply to a line or two. A page can draw, move and respond, and prose can't: make the figures carry the argument and let the words annotate them.

This skill builds level 1 of `arc-design`'s pyramid, a page. Level 1 has two rungs: a static page, the default, and a scripted page for a click CSS can't handle. `arc-design` holds the look every level shares and routes a request that needs a lasting app to level 2, `arc-web-production`.

`<skill-dir>` is this skill's folder and `<arc-design>` is the `arc-design` skill's folder, its sibling.

## Steps

1. **Decide: page, plain text, or app.**
   - **A page** when the reply is an explanation, how/why answer or walkthrough; a comparison, trade-off or recommendation; a plan, proposal or opinion piece; a review, audit or findings list; a report of finished work; or anything with a table, a chart, a diagram, a before/after, or more than ~5 bullet points. When unsure, make the page.
   - **Plain text** when the reply is one or two sentences, a yes/no or a single fact; a command, path or snippet the user will copy; a clarifying question or a progress note mid-task; or the user said "in chat", "just tell me" or "short answer".
   - **An app** when the request needs state, which a page never keeps: a vote or poll, a sign-up sheet, a shared checklist, live numbers, sign-in, anything one person types into and others see. Still a page: a checklist the user prints or ticks off alone, numbers you already have, a plan or report about an app. If the user asked for a page and it needs state, say so in one line and confirm before building; if they asked for the app itself, build it. Either way build it by [lakebed.md](lakebed.md); the write-up about it is a page, by the steps below.

   Completion: the form is chosen. Plain text ends the skill here.
2. **Plan the figures before the prose.** List the page's claims and give each one the figure that proves it, from the table under Figures. An explanation, comparison, plan or review has at least two figures. A section with a claim and no figure needs a reason, such as a list of facts with no shape. A work report gets a figure when the work has numbers or a mechanism: a timing that fell, a flow that changed. Completion: every claim names its figure or its reason for having none, and one figure is picked as the hero.
3. **Read what this page calls for**, before you write it. Read each file only when its case applies, and follow it in step 4:
   - The page has a chart (`bars`, `line`, `donut`, `units`, `stats`, `stacked` or `heat`): [charts.md](charts.md).
   - A figure is a `flow` or a `diagram`, or the source is Mermaid, draw.io or Excalidraw: [diagrams.md](diagrams.md).
   - You write an animation or a loop the kit doesn't have, or a figure must not move: [motion.md](motion.md).
   - The user asks for art or a cover for a page they will present, or the core idea has a gesture a Hairline figure can show: [illustrations.md](illustrations.md). Otherwise the page has no illustration.
   - The page is about an interface, or the user asks for a UI still or an animated product demo: [stills.md](stills.md). Otherwise the page shows no product UI.
   - A click must change what the page shows and CSS can't do it (a strict Back-and-Next walk, a sortable table): [scripted.md](scripted.md). Tabs, toggles and step-lit figures stay static.
   - The page puts options in front of the user to pick from: [decisions.md](decisions.md). Not for a yes or no you ask before building.

   Completion: every case that applies was read, and none of the others.
4. **Write the page.** Start from [template.html](template.html), which holds every shared token and base rule; open it with your file-read tool. Copy the blocks you need from [components.html](components.html): each is marked `/* component: name */` in the CSS and `<!-- component: name -->` in the markup, and already follows the contract. The file is too long for one read, so search it for `component: <name>` and read each block's CSS and markup. Write the file to the scratchpad (or the location the user names), e.g. `<scratchpad>/<topic-slug>/index.html`. Follow Content, Visual first, The Postplan contract and Design below, and the files step 3 sent you to. Delete the markup of template blocks you don't use (the `.row` before/after rows, the packet); their CSS may stay, and the lint ignores it. For a part the kit lacks, build it from the page tokens. Completion: the title, headline and kicker placeholders are replaced, no unused template markup is left, every number, path and command on the page comes from this session or is labelled, and the page has no illustration, still or script without its case in step 3.
5. **Check it.** Run both, from any directory, and fix every `FAIL`:

   ```sh
   bash <skill-dir>/scripts/lint.sh <file.html>          # a scripted page: lint.sh --scripted
   node <arc-design>/scripts/check-tokens.mjs <file.html>
   ```

   The lint enforces the contract and the motion rules, fails any `<svg>` without a title and a desc, and warns on a missing page title or viewport and on em dashes. When diagram-design is installed it also runs that skill's `self_check.py --offline` on pages with an accessible SVG. Completion: both commands exit 0 with no `FAIL`.
6. **Look at it.** In T3 Code, load `mcp__t3-code__html_preview` and `html_render` with ToolSearch. `html_preview` the file at width 728, and again at 390 with `appearance: "light"`. Fix overflow, cramped diagrams and unreadable contrast. A half-drawn bar, a number still counting or a note not yet landed is an entrance caught mid-flight, not a bug: the frame sheet's poster shows the settled figure. With only a headless browser, take the same two screenshots yourself and set the colour scheme explicitly (Playwright: `colorScheme: "dark"` or `"light"`): a headless browser defaults to light.

   A page with an entrance or a control also gets filmed: `node <skill-dir>/scripts/frames.mjs <file.html> --select "<main visual>"`, with `--states '<selector of each control's input, separated by ;>'` for controls. Preview the sheet it writes and read every frame; [frames.md](frames.md) says what to select, how to size and split the sheet, and what to read in it. Never render, lint or publish the sheet.

   Completion: no sideways page scroll, nothing clipped and readable text at 728 (dark) and at 390 (light); the poster frame shows the finished figure; and each control's state frame shows its step or its new values. Whatever you didn't preview, the reply calls unverified: the lint can't check layout.
7. **Show it.**
   - **Inline in T3 Code:** `html_render` with the `contentHeight` from the preview (capped at 2000; content past that scrolls). Write the page once with the template's `/* standalone */` block: that file is the one to publish. For the inline render, render a copy with that block deleted (`inline.html` next to it), because the thread supplies the background and the side gutter.
   - **Publish to Postplan** when the page is a write-up, report, plan, opinion, or anything the user may keep, revisit or share, or when they ask for a link. If the user says they will send, share, post or present it, publishing is required: a local file path can't be sent to a team. Save to any path they name *and* publish. Outside T3 Code with no render tool, publish and give the link.

     ```sh
     cd ~ && npx -y postplan@0.0.6 check <file.html>
     cd ~ && npx -y postplan@0.0.6 upload <file.html> --new --description "<one sentence>" --json
     # later edits to the same page:
     cd ~ && npx -y postplan@0.0.6 upload <file.html> --draft <draftId> --json
     ```

     `check` must print `Ready.` The page is published only when the receipt says `"ok": true`; report its `url`. Read the exit code directly; don't pipe the upload through `tail` or `head`. A runner failure (no npx, registry DNS errors) is not a Postplan failure: say which it was.

   Completion: the page is rendered inline where a render tool exists, and a page that had to be published has a receipt with `"ok": true`.
8. **Reply, then ask.** The reply is at most three sentences, caveats included: the main point in plain words, the link (if published) or the file path, and what wasn't verified or needs the user's decision. The comparison, options and details live on the page; never paste them back into chat. When the user must choose, the question dialog is your last call ([decisions.md](decisions.md)). Completion: the reply is three sentences or fewer, and no table, list or option detail from the page is pasted into it.

## Content

- **Kicker:** the small line above the headline names the project and topic in a few words (`arc-skills · auth`). When the request names no project, name the subject and the topic (`auth · session refresh`); never invent a project name.
- **Lead with the answer.** The headline is the verdict or main point, not the topic. Its `<em>` marks the few words that carry the verdict. The `<title>` is a name of two to four words. The first paragraph says what to do or what's true.
- **One idea per section.** A short `h2` that states the point, then the evidence.
- **Real data only.** Numbers, file paths, commands and results come from this session. Numbers derived from them (a total, a projected saving) are fine if the page shows the arithmetic or calls them estimates. Label anything illustrative as illustrative. Write dates as absolute dates, never "3 days ago", and only when you know them. A relative date in the user's own data ("last week") is quoted as given, next to the date it was said; don't guess its bounds. A value you don't have is written as unknown ("revision: unknown", "exact command not recorded"), never invented.
- **Plain words.** Short sentences. No jargon the user hasn't used. Name files by repo-relative path (`src/auth/session.ts`).
- **Keep it short.** Most pages are 3–6 sections. A small work report may be two: the changes and the packet. Cut anything the user won't act on.
- **End reports of work with a packet**, whether you did the work or the user describes it as yours. Analyses of data, plans and explanations get no packet. The packet holds the revision, what changed, commands run and results (its `evidence` lines), checks, and open questions.
  - With a `changes` table above it, the packet's changed line is just the total (`4 files, +120 −31`). Open items live only in its open line, not in a second list. Several commands go as a list under the one evidence key.
  - Give each check its own line, worst first (`FAIL`, then `NOT_RUN`, then `PASS`), and make the section's heading the tally in the same order (`Checked: 1 FAIL, 2 NOT_RUN, 5 PASS`).
  - Label every check with the literal word `PASS`, `FAIL` or `NOT_RUN` (a review's `findings` may also use `WARN`), never prose like "not run yet", so the status can be scanned and grepped. A check only proves what it exercised: anything that wasn't run is `NOT_RUN`, and a check with no record of its result is `NOT_RUN` with "not recorded" as the reason.
  - Write the packet in plain words, with `<code>` only around literal values (a revision, a command, a path).

## Visual first

- **The hero figure answers.** Put the main figure in the first section, under only its `h2` and at most one `.sub` line. A reader who only looks at it gets the verdict: the winning bar is in the accent, the failing step is lit, the route that matters carries a packet. A figure tells one accent story: the key box, its route, its packet and its note count as one, and everything else stays neutral.
- **Annotate the figure.** Write the takeaway onto the chart with `annotate` ("8× esbuild", "fails here"), not only in the paragraph under it.
- **Make it explorable when the idea has states.** A path or a sequence of stages gets `steps`. A before/after, a fix or a what-if gets `toggle`. Several series get `focus`. Marks that print no value of their own (heat cells, units) get `tip`, and `chart.mjs line` draws a hover read-out by itself.
- **Interaction adds, never hides.** A screenshot, a thumbnail, a raw-HTML fetch and reduced motion see only the resting state, so it must tell the whole answer: `steps` rests on "All", a `toggle` rests on the state that carries the verdict.
- **Move to show meaning.** The hero figure enters, data slides when a switch flips, a packet rides the main route. The kit's blocks already move this way. Never animate the headline or the lede.
- **No decoration.** No stock icons, ornamental gradients, glows, or motion that carries nothing.

## Figures

| The claim | Figure |
|---|---|
| X is bigger or faster than Y | `bars`, sorted, the winner in the accent, `annotate` on the gap |
| It changed over time | `line` (hover read-out included) |
| A fix or option changes the numbers | `toggle` around `bars --then` (bars slide to the new values) |
| A rate with a small denominator ("5 of 60 failed") | `units`, up to 100 cells |
| A headline number | `stats` (a number with its denominator, or its unit when it has none); `count` makes a whole number count up |
| One share is the headline | `donut` |
| How one whole splits (stages of one build, parts of one budget) | `stacked`, with `focus` for four series; separate tools or options are `bars` |
| A pattern across two keys | `heat`, with a `tip` per cell |
| How it works, a straight line of five steps or fewer | `flow` |
| How it works, with forks: an architecture, a sequence, a state machine | `diagram` (the shell for diagram-design output), a `packet` on the main route |
| It happens in stages the reader should walk | `steps` around a `flow` or `diagram` |
| When things happened | `timeline` |
| Options against criteria | `compare` (table), plus a figure of the number that decides it |
| Review or audit results | `findings` (literal status word first) |
| Files the work touched | `changes` (table, above the packet) |
| A choice the user must make | `decisions`, then the question dialog |
| Views of one thing | `tabs` (radio and label, no script) |
| Evidence and raw data | `details` |
| An illustration (opt-in) | `hairline` or `spot`, one per page |
| A product UI (opt-in) | `stage`, one still per page |

## The Postplan contract

Every page follows Postplan 0.0.4's rules, even pages that are only rendered in T3. One static page then looks the same inline in T3, on Postplan, and when another agent fetches it raw.

- **No JavaScript.** No `<script>` (inline or `src`), no `on*=` handler attributes, no `javascript:` URLs. Postplan rejects `<script src>` at upload and serves pages with `script-src 'none'`, so inline scripts never run either. Charts, tabs and motion are SVG and CSS. The scripted rung is the one exception, under its own rules.
- **One inline `<style>`.** No `<link>` (blocked tag), no `@import`, no `@font-face` or web fonts (CSP `default-src 'none'`). Use the template's font stacks: they name Geist first, so a reader who has it installed sees it, and everyone else sees the system fonts behind it.
- **No forms, iframes, embeds, objects, `<base>`, or meta refresh.** Interaction is CSS: radio and checkbox `<input>`s inside `<label>`s, outside any `<form>`, read with `:has()`, plus `:hover` and `:focus-visible`. No `<button>` or `<select>` on a static page: nothing on it sends anything anywhere.
- **Images from `https:` or `data:` only.** A local `chart.png` will not load.
- **Budget 512 KiB per page**, the 0.0.4 server default. `postplan check` reports the real limit for the account.
- **Nothing private.** No secrets, tokens, private URLs, or absolute local paths (`/home/…`, `/Users/…`, `/tmp/…`, the scratchpad). Name a local folder relative to the project, or from `~`. Postplan links are viewable by anyone who has them.

## Design

The template sets this up:

- **This section is the page's look step.** `arc-design`'s steps 1 and 2 are routing, already done once you are in this skill; don't repeat them or add its routing sentence. Its step 3 is met by the template's token block, the page's copy of the tokens, and the token check in step 5. Its step 4 applies to what you built yourself: before hand-building a part the kit lacks, read its Taste rules section, and its Motion section when the part moves. Its reviews are optional for a page. Name one only when you ran it, in the packet or in a `.note`, never in the chat reply.
- **Spec-like, not a landing page.** A plain headline sized as a heading, not a hero. Figures, tables and lists over decorative card chrome. No marketing voice, no em dashes.
- **The look is `arc-design`'s:** dark first, one pink accent, green, red and yellow for status only, Geist first with system fonts behind it. Don't change a token's value on a page.
- **Colors as tokens on `:root`.** Don't name your own tokens after T3's theme variables (`--card`, `--muted`, `--accent`, `--border`…): `--card: var(--card, …)` is a cycle and silently breaks, and overriding them restyles the thread. Read T3's values as fallbacks instead, like the template's `--surface: var(--card, #0e0e11)`.
- **Readable at 390px wide:** single column under 720px, no horizontal page scroll, 16px side gutter. Give tables of three or more columns `class="stack-sm"` so rows stack on phones instead of squeezing. The header row is hidden when rows stack, so a cell that means nothing without its column gets `data-label="<column>"`.
- **External links** get `target="_blank" rel="noopener noreferrer"`.

## Maintaining this skill

Before merging a change to this skill, run the tests and the release gate in [tests/fresh-agent.md](tests/fresh-agent.md).
