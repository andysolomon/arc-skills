---
name: arc-html-response
description: Answer with an HTML page instead of terminal prose. Use for replies that explain, compare, plan, review, recommend, or report finished work, or that have structure (steps, options, numbers, a flow). Renders inline in T3 Code and publishes keepable write-ups to Postplan. Skip for one-liners, yes/no, commands to copy, and clarifying questions.
---

# HTML response

The user reads pages better than terminal scrollback. When a reply has shape — steps, options, a comparison, a flow, numbers, evidence — make it a small HTML page, show it, and keep the chat reply to a line or two.

## Decide: page or plain text?

Make a page when the reply is any of:
- an explanation, how/why answer, or walkthrough
- a comparison, trade-off, or recommendation
- a plan, proposal, or opinion piece
- a review, audit, or findings list
- a report of finished work (what changed, what was checked, what's open)
- anything with a table, a diagram, a before/after, or more than ~5 bullet points

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
- **Draw the mechanism, not decoration.** Use a visual only when it carries meaning: a flow (inline SVG boxes and arrows), a from → to table, a ladder or ranking, a stat with its denominator, a checklist. No stock icons, no ornamental gradients.
- **Real data only.** Numbers, file paths, commands and results come from this session. Label anything illustrative as illustrative.
- **Plain words.** Short sentences. No jargon the user hasn't used. Name files as paths.
- **End reports of work with a packet:** revision, what changed, commands run and results, checks, open questions. Label every check with the literal word `PASS`, `FAIL`, or `NOT_RUN`, never prose like "not run yet", so the status can be scanned and grepped. A check only proves what it exercised; anything that wasn't run is `NOT_RUN`.
- **Keep it short.** Most pages are 3–6 sections. Cut anything the user won't act on.

Design (the template already does this):
- Colors as tokens on `:root`, working in dark and light. Don't name your own tokens after T3's theme variables (`--card`, `--muted`, `--accent`, `--border`…): `--card: var(--card, …)` is a cycle and silently breaks, and overriding them restyles the thread. Read T3's values as fallbacks instead, like the template's `--surface: var(--card, #131317)`.
- Readable at 390px wide: single column under 720px, no horizontal page scroll, 16px side gutter.
- Self-contained: inline CSS and SVG. External scripts only from cdnjs/jsdelivr/unpkg with an exact pinned version, and only when a chart truly needs it.
- One accent color for emphasis; green/red/yellow only for status (pass/fail/warn).

## Show it

**In T3 Code** (the `mcp__t3-code__html_preview` / `html_render` tools exist; load them with ToolSearch):
1. `html_preview` the file at width 728, and again at 390 with `appearance: "light"`. Fix overflow, cramped diagrams (add a stacked phone version), or unreadable contrast.
2. `html_render` it with the `contentHeight` from the preview (capped at 2000; content past that scrolls). For inline rendering, remove the `/* standalone */` background rule from the template, because the thread supplies the background; map colors to T3's theme variables (the template's `var(--foreground, …)` fallbacks already do).
3. Don't restate the page in the reply.

**Publish to Postplan** when the page is a write-up, report, plan, opinion, or anything the user may keep, revisit, or share, or when they ask for a link (global instructions: HTML write-ups and reports go to Postplan). If the user says they will send, share, post, or present it, publishing is required: a local file path can't be sent to a team. Save to any path they name *and* publish.

```sh
cd ~ && npx -y postplan upload <file.html> --new --description "<one sentence>" --json
# later edits to the same page:
cd ~ && npx -y postplan upload <file.html> --draft <draftId> --json
```

Report the `url` from the receipt. Keep the standalone background rule for Postplan pages. Postplan links are viewable by anyone who has them: never put secrets, tokens, keys, or other people's private data on a page. Limit is 4 MiB per upload; `npx -y postplan check <file>` validates without publishing.

Outside T3 Code with no render tool, publish to Postplan and give the link.

## The chat reply

After the page is shown or published, the reply is at most three sentences, caveats included: the main point in plain words, the link (if published) or the file path, and what wasn't verified or needs the user's decision. The comparison, options, and details live on the page; never paste them back into chat.
