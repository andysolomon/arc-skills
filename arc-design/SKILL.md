---
name: arc-design
description: The shared design rules above the arc response and build skills. Picks the layer a request belongs to (static page, web app, Salesforce, system architecture) and holds the one look every layer uses - colour tokens, type, motion timings, taste rules. Use when asked to design, restyle or polish a page or app, to decide between a page, a prototype and a production app, or when a layer skill (arc-html-response, arc-web-production, arc-salesforce-engineering, arc-system-architecture) says to load it. Holds no components or code of its own.
---

# Design

The top of an upside-down pyramid. Each layer below builds one kind of thing; this skill keeps them looking and behaving like one system.

| Layer | Builds | Status |
|---|---|---|
| `arc-html-response` | A static page: answers, reports, write-ups. No script. | built |
| `arc-web-production` | A web app that lasts: Foldkit on Effect, deployed with Alchemy. | built |
| `arc-salesforce-engineering` | Screens and configuration inside a Salesforce org: LWC, Apex, metadata. | built |
| `arc-system-architecture` | Where things run: stacks, clusters, tunnels, drawn as an architecture page. | built |

## Steps

1. **Pick the layer.** Ask in order; the first yes wins.
   1. Is it an answer, a report or a write-up that nobody types into? `arc-html-response`.
   2. Does someone type into it, or must it keep working after today? `arc-web-production`. It picks its own rung (static render, Lakebed prototype, full app).
   3. Does it run inside a Salesforce org, or change an org's configuration? `arc-salesforce-engineering`.
   4. Is the question where and how things run, or how the parts reach each other? `arc-system-architecture`. It answers with a page, so it also uses `arc-html-response`.

   Completion: one sentence names the layer and the question that chose it.
2. **Load that layer's skill** and follow it. When it reaches its look step, do steps 3 and 4 here, then go back to it. Completion: the layer skill's own steps are done.
3. **Apply the look.** Use [tokens.css](tokens.css) as the only source of colours, fonts and timings. Copy it byte for byte (`cp`); extra tokens one app needs go in that app's own stylesheet, never in the copy. A screen inside a Salesforce org uses the generated variant instead (see Host exception). Completion: the work has no colour or duration that isn't a token, `node <skill-dir>/scripts/check-tokens.mjs <copy>` passes for every copied token file, and in an app `npm run lint:styles` passes.
4. **Check the taste rules and motion rules below** against the finished work. Completion: each rule holds, or the reply says which one doesn't and why.

## The look

- **Dark first.** True black page, white text, dark grey only for secondary surfaces. Light mode through `prefers-color-scheme`.
- **One accent**, the token `--hi` (pink). Green, red and yellow are for status only: pass, fail, warn.
- **Text on the accent** uses `--on-hi`, never a guessed black or white.
- **System fonts only**: the `--sans` and `--mono` stacks. No web fonts.
- **Host exception.** A screen that runs inside another product takes that product's accent and theme so it matches its host: inside a Salesforce org, `--hi` is Salesforce blue `#0176d3`, `--on-hi` is white, and the light values apply whatever the system theme, because Lightning is a light host. Type, spacing, status colours and motion stay the same. `arc-salesforce-engineering` generates that variant from `tokens.css` (`scripts/sync-tokens.mjs`) instead of copying it, and its `--check` mode keeps the variant in step.
- **Copies must match.** A layer that needs the tokens copies `tokens.css` byte for byte and never edits the copy. `check-tokens.mjs` compares values, so a page's token block (which reads the host's theme through `var(--host, value)` fallbacks) also passes.
- **What each token is for:** `--bg` page, `--surface` raised areas such as inputs and panels, `--fg` text, `--dim` secondary text and labels, `--line` borders and rules, `--hi` the accent, `--on-hi` text on the accent, `--link` links on pages, `--ok`, `--bad`, `--warn` status only, `--c1` to `--c4` chart series, `--sans` and `--mono` fonts, `--ease` the one easing, `--t-micro`, `--t-state`, `--t-enter` and `--stagger` the timings.
- **Forcing a theme:** dark is the default. `data-theme="dark"` on `<html>` keeps dark even when the system is light. There is no forced light.

## Taste rules, every layer

- **Answer first.** A page's headline says the main point, not the topic. An app's first screen shows the user's own data and the main action, not a welcome.
- **Real data only.** A value you don't have is written as unknown, never invented.
- **Draw the mechanism, not decoration.** No stock icons, ornamental gradients or card chrome.
- **A picture of one of our own apps comes from the real app**: a screenshot of it running. A hand-built or faux UI (Stageshow) is only for an interface that doesn't exist yet or isn't ours.
- **Every state has a screen.** Loading, empty, failure and stale each show something specific. Empty says how to add the first item. Failure says what to do next, or, when the app retries by itself, that it is retrying. Stale keeps the last good data visible.
- **Plain words.** Error text is a sentence a non-engineer can act on. Technical causes go to logs and tests.
- **Every control has a label**, and tests find controls by role and label.
- **Phone first.** Works at 390 px: one column, 16 px side gutter, no sideways page scroll, touch targets at least 44 px tall.
- **Numbers** in columns, counters and tables use tabular figures.
- **Prose** stays near 65 characters a line. A list row or a table may run wider; its text cell still caps at 65ch.
- **Say what was not verified.** A check is `PASS`, `FAIL` or `NOT_RUN`, in those literal words. A check proves only what it exercised.

## Motion, every layer

- **Motion shows meaning**: a state changed, an order, a direction, a size. No decorative loops, no text effects.
- **CSS only.** No animation library (GSAP, Motion). If a request truly needs one, say so and ask before adding it.
- **Use the timing tokens**: `--t-micro` for hover, `--t-state` for a state change, `--t-enter` for an entrance, `--stagger` between items, with `--ease`.
- **Inside `@media (prefers-reduced-motion: no-preference)`**, always: every animation and every transition, hover included.
- **Animate from the start state** (`animation-fill-mode: backwards`), on `transform` and `opacity`, each animation under one second. The resting frame, which is what a screenshot or reduced motion shows, must tell the story on its own.

Each layer adds its own motion rules on top: a page has one entrance moment and no scroll-driven animation (`arc-html-response`); an app gives each state its own `@keyframes` name (`arc-web-production`).

## How this skill grows

A rule starts in the layer that first needs it. When a second layer needs the same rule, move it here and replace it in both layers with a pointer. A rule only one layer uses stays in that layer.

Changing this skill? Run `node <skill-dir>/scripts/check-tokens.mjs`, then the release gate of every layer whose behaviour the change touches (`arc-html-response/tests/fresh-agent.md`, `arc-web-production/tests/test-template.sh`, `arc-salesforce-engineering/tests/test-template.sh`, which also checks the org's token variant, and `arc-system-architecture/tests/test-inventory.sh`).
