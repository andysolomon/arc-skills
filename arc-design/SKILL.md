---
name: arc-design
description: The shared design rules above the arc response and build skills. Picks the level and the layer skill a request belongs to (page, app, interaction, realtime, 3D, Salesforce, system architecture) and holds the one look every layer uses - colour tokens, type, motion timings, taste rules. Use when asked to design, restyle or polish a page or app, to decide between a page, a prototype and a production app, to place a gesture, live-connection or 3D request, or when a layer skill (arc-html-response, arc-web-production, arc-salesforce-engineering, arc-system-architecture) says to load it. Holds no components or code of its own.
---

# Design

The top of the pyramid. The skills under it build things; this skill keeps them looking and behaving like one system. A layer skill is any skill that builds under these rules.

The UI side has five levels, ordered by what the browser has to run. A level may use any level below it and never one above it.

| Level | Adds | Layer skill | Status |
|---|---|---|---|
| 1 Page | Static HTML, SVG and CSS: answers, reports, write-ups. No script. | `arc-html-response` | built |
| 2 App | State, a server and tests: a Lakebed prototype first, then Foldkit on Effect, deployed with Alchemy. | `arc-web-production` | built |
| 3 Interaction | Drag, swipe, springs and layout moves, where CSS keyframes stop being enough. | `arc-interaction` | planned |
| 4 Realtime | Live connections: WebSockets, WebRTC, presence. | `arc-realtime` | planned |
| 5 3D | Scenes on the GPU: three.js, WebGL, shaders. | `arc-3d` | planned; `arc-webgl-performance` covers performance today |

Two layer skills sit beside the levels:

| Layer skill | Builds | Status |
|---|---|---|
| `arc-salesforce-engineering` | Screens and configuration inside a Salesforce org: LWC, Apex, metadata. A host, not a level: its screens take the host exception. | built |
| `arc-system-architecture` | Where things run: stacks, clusters, tunnels, drawn as an architecture page. It decides where the servers behind levels 2 and 4 run. | built |

A tool that outputs a file is a maker, not a level: a diagram, an illustration, a still, a film, a 3D render. Any level may embed or link the file, so film and offline renders have no level of their own.

## Steps

1. **Pick the layer skill.** Ask in order; the first yes wins.
   1. Is it an answer, a report or a write-up that nobody types into? Level 1, `arc-html-response`.
   2. Does someone type into it, or must it keep working after today? Level 2, `arc-web-production`. It picks its own rung (static render, Lakebed prototype, full app). Then name the highest level the request needs:
      - a drag, a swipe, a spring or a layout move: level 3.
      - a live connection (a WebSocket, WebRTC, presence): level 4.
      - a scene on the GPU (three.js, WebGL): level 5.

      The skills for levels 3 to 5 don't exist yet. Say so and build the app with `arc-web-production`. At level 4, `arc-system-architecture` decides where the socket or media server runs. At level 5, also load `arc-webgl-performance`.
   3. Does it run inside a Salesforce org, or change an org's configuration? `arc-salesforce-engineering`.
   4. Is the question where and how things run, or how the parts reach each other? `arc-system-architecture`. It answers with a page, so it also uses `arc-html-response`.

   Completion: one sentence names the layer skill, the level when the request is a UI, and the question that chose it.
2. **Load that layer's skill** and follow it. When it reaches its look step, do steps 3 and 4 here, then go back to it. Completion: the layer skill's own steps are done.
3. **Apply the look.** Use [tokens.css](tokens.css) as the only source of colours, fonts and timings. Copy it byte for byte (`cp`); extra tokens one app needs go in that app's own stylesheet, never in the copy. A screen inside a Salesforce org uses the generated variant instead (see Host exception). Completion: the work has no colour or duration that isn't a token, `node <skill-dir>/scripts/check-tokens.mjs <copy>` passes for every copied token file, and in an app `npm run lint:styles` passes.
4. **Check the taste rules and motion rules below** against the finished work. Completion: each rule holds, or the reply says which one doesn't and why.

## The look

- **Dark first.** True black page, white text, dark grey only for secondary surfaces. Light mode through `prefers-color-scheme`.
- **One accent**, the token `--hi` (pink). Green, red and yellow are for status only: pass, fail, warn.
- **Text on the accent** uses `--on-hi`, never a guessed black or white.
- **Geist first, system fonts behind it.** `--sans` starts with Geist and `--mono` with Geist Mono, and the system stacks follow. No other typeface, and never a font from a CDN. An app or a film may bundle the Geist files (SIL Open Font License) and declare them with `@font-face` from its own origin. A page can't load a font, because Postplan blocks `@font-face`. So a page shows Geist only to a reader who has it installed, and system fonts to everyone else.
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
- **CSS first.** A page is CSS only, because it runs no script. From level 3 up, Motion's plain JavaScript `animate()` is allowed for three cases CSS can't do: a drag or swipe that carries its velocity, a layout move (an element changes place or size), and a spring the user can interrupt. Name the case before adding it. Everything else stays CSS. GSAP and every other animation library stay out, and Motion's React API can't run in Foldkit. A Motion animation still rests under reduced motion and still moves only `transform` and `opacity`. Motion inside a Foldkit view is unproven: the first app that uses it writes a test that shows it mounts, before building on it.
- **Use the timing tokens**: `--t-micro` for hover, `--t-state` for a state change, `--t-enter` for an entrance, `--stagger` between items, with `--ease`.
- **Inside `@media (prefers-reduced-motion: no-preference)`**, always: every animation and every transition, hover included.
- **Animate from the start state** (`animation-fill-mode: backwards`), on `transform` and `opacity`, each animation under one second. The resting frame, which is what a screenshot or reduced motion shows, must tell the story on its own.

Each layer adds its own motion rules on top: a page has one entrance moment and no scroll-driven animation (`arc-html-response`); an app gives each state its own `@keyframes` name (`arc-web-production`).

## How this skill grows

A rule starts in the layer that first needs it. When a second layer needs the same rule, move it here and replace it in both layers with a pointer. A rule only one layer uses stays in that layer.

Changing this skill? Run `node <skill-dir>/scripts/check-tokens.mjs`, then the release gate of every layer whose behaviour the change touches (`arc-html-response/tests/fresh-agent.md`, `arc-web-production/tests/test-template.sh`, `arc-salesforce-engineering/tests/test-template.sh`, which also checks the org's token variant, and `arc-system-architecture/tests/test-inventory.sh`).
