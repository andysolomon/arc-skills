---
name: arc-design
description: The shared design rules above the arc response and build skills. Picks the level and the layer skill for a request (page, app, interaction, realtime, 3D, Salesforce, system architecture), holds the one look every layer uses - colour tokens, type, motion timings, taste rules - and names the makers and reviews. Use when asked to design, restyle or polish a page or app, to choose between a page, a prototype and an app, to place a gesture, live-connection, 3D or film request, or when a layer skill says to load it. Holds no components or app code of its own.
---

# Design

The top of an upside-down pyramid. The pyramid starts narrow at a static page and widens as each level adds something to run. This skill is the wide top: it builds nothing, and its rules cover every level. A layer skill is any skill that builds under these rules.

Each level has a UI side, which is what the browser has to run, and an architecture side, which is what has to run behind it. A level may use any level below it and never one above it.

| Level | UI side | Architecture side | Layer skill |
|---|---|---|---|
| 1 Page | Static HTML, SVG and CSS: answers, reports, write-ups. No script. | Nothing runs. A file is published. | `arc-html-response` |
| 2 App | State, a server and tests: a Lakebed prototype first, then Foldkit on Effect. | A server that keeps state: Lakebed for a try, then a Worker with a Durable Object. | `arc-web-production` |
| 3 Interaction | Drag, swipe, springs and layout moves, where CSS keyframes stop being enough. | Nothing new. It all runs in the browser. | `arc-interaction` |
| 4 Realtime | Live connections: WebSockets, presence, WebRTC. | A server that holds connections open. WebRTC media also needs a TURN or media server. | `arc-realtime` |
| 5 3D | Scenes on the GPU: three.js, WebGL, shaders. | Storage for models and textures. An offline render needs a host with a GPU. | `arc-3d`, with `arc-webgl-performance` for frame rate |

Two layer skills sit beside the levels:

| Layer skill | Builds |
|---|---|
| `arc-system-architecture` | The architecture side of every level: where each part runs, how it is reached and what starts it. Its runs-on ladder also has rungs with no UI level, such as a CI runner, a container and a cluster. |
| `arc-salesforce-engineering` | Screens and configuration inside a Salesforce org: LWC, Apex, metadata. A host, not a level: its screens take the host exception. |

A tool that outputs a file is a maker, not a level: a diagram, an illustration, a still, a figure, a film, a 3D asset. Any level may embed or link the file. [makers.md](makers.md) lists the makers and how each takes the look. [film.md](film.md) holds the rules for a film.

## Steps

1. **Pick the layer skill.** Ask in order; the first yes wins.
   1. Is it an answer, a report or a write-up that nobody types into? Level 1, `arc-html-response`.
   2. Does someone type into it, or must it keep working after today? Level 2, `arc-web-production`. It picks its own rung (static render, Lakebed prototype, full app). Then load the skill of every higher level the request needs:
      - a drag, a swipe, a spring or a layout move: level 3, `arc-interaction`.
      - a live connection (a WebSocket, presence, WebRTC): level 4, `arc-realtime`.
      - a scene on the GPU (three.js, WebGL): level 5, `arc-3d`.
   3. Does it run inside a Salesforce org, or change an org's configuration? `arc-salesforce-engineering`.
   4. Is the question where and how things run, or how the parts reach each other? `arc-system-architecture`. It answers with a page, so it also uses `arc-html-response`.
   5. Is it a film or a video? Read [film.md](film.md). A film is a maker's output, so the page or app that shows it still goes through questions 1 and 2.

   Completion: one sentence, in the reply or in the report, names the layer skill, the level when the request is a UI, and the question that chose it.
2. **Load that layer's skill** and follow it. When it reaches its look step (in `arc-html-response`, its Design section), do steps 3 and 4 here, then go back to it. Completion: the layer skill's own steps are done.
3. **Apply the look.** Use [tokens.css](tokens.css) as the only source of colours, fonts and timings. Copy it byte for byte (`cp`); extra tokens one app needs go in that app's own stylesheet, never in the copy. A page can't copy a stylesheet: it uses the token block in `arc-html-response`'s template, which the checker also accepts. A screen inside a Salesforce org uses the generated variant instead (see Host exception). Completion: the work has no colour or duration that isn't a token, `node <skill-dir>/scripts/check-tokens.mjs <copy>` passes for every copied token file, and in an app `npm run lint:styles` passes.
4. **Check the taste rules and motion rules below** against the finished work. Then read [reviews.md](reviews.md) and run each review there that is installed and fits the level. Completion: each rule holds, or the reply says which one doesn't and why. In an app's report, each review is named with its findings, or as `NOT_RUN` when it isn't installed or can't be started. A page names only the reviews it ran. Neither goes in the chat reply.

## The look

- **Dark first.** True black page, white text, dark grey only for secondary surfaces. Light mode through `prefers-color-scheme`.
- **One accent**, the token `--hi` (pink). Green, red and yellow are for status only: pass, fail, warn.
- **Text on the accent** uses `--on-hi`, never a guessed black or white.
- **Geist first, system fonts behind it.** `--sans` starts with Geist and `--mono` with Geist Mono, and the system stacks follow. No other typeface, and never a font from a CDN. An app bundles the Geist files (SIL Open Font License) and declares them with `@font-face` from its own origin: `arc-web-production`'s template does this in `src/fonts.css`. A film always bundles them (see film.md). A page can't load a font, because Postplan blocks `@font-face`. So a page shows Geist only to a reader who has it installed, and system fonts to everyone else.
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
- **Every control has a label**, and tests find controls by role and label. A placeholder is not a label.
- **Every control shows its state.** Hover, pressed, keyboard focus and disabled each look different; opacity does it without a new colour. Keyboard focus is a 2 px ring in `--hi`, 2 px off the control. A submit shows that it is working.
- **Real elements.** A button is a `<button>` and a link is an `<a href>`, never a `<div>` with a click handler. One `<h1>`, no skipped heading level, and `lang` on `<html>`.
- **Contrast.** Text is at least 4.5:1 against what it sits on. Large text is at least 3:1, and so is a mark that alone carries meaning: a status dot, a chart line, a focus ring. A border or rule in `--line` is not such a mark. Colour is never the only signal.
- **Nothing hides behind hover.** What a pointer reveals is also there for touch and keyboard, and a gesture always has a button that does the same thing.
- **Phone first.** Works at 390 px: one column, 16 px side gutter, no sideways page scroll, touch targets at least 44 px tall. It still doesn't scroll sideways at 320 px.
- **Numbers** in columns, counters and tables use tabular figures.
- **Prose** stays near 65 characters a line. A list row or a table may run wider; its text cell still caps at 65ch.
- **Say what was not verified.** A check is `PASS`, `FAIL` or `NOT_RUN`, in those literal words. A check proves only what it exercised.

## Motion, every layer

- **Motion shows meaning**: a state changed, an order, a direction, a size. No decorative loops, no text effects.
- **CSS first.** A page is CSS only, because it runs no script. From level 3 up, Motion's plain JavaScript `animate()` is allowed for three cases CSS can't do: a drag or swipe that carries its velocity, a layout move (an element changes place or size), and a spring the user can interrupt. Name the case before adding it. Everything else stays CSS. GSAP and every other animation library stay out of pages and apps, and Motion's React API can't run in Foldkit. A Motion animation still rests under reduced motion and still moves only `transform` and `opacity`. `animate()` does not check the reduced-motion setting by itself, so the code that calls it must. `arc-interaction` holds the pattern, proven through a Foldkit Mount on `motion` 14.14.0, and its tests.
- **Use the timing tokens**: `--t-micro` for hover, `--t-state` for a state change, `--t-enter` for an entrance, `--stagger` between items, with `--ease`.
- **Inside `@media (prefers-reduced-motion: no-preference)`**, always: every animation and every transition, hover included.
- **Animate from the start state** (`animation-fill-mode: backwards`), on `transform` and `opacity`, each animation under one second. The resting frame, which is what a screenshot or reduced motion shows, must tell the story on its own.

Each layer adds its own motion rules on top: a page has one entrance moment and no scroll-driven animation (`arc-html-response`); an app gives each state its own `@keyframes` name (`arc-web-production`); a gesture ends in a Message and keeps a button beside it (`arc-interaction`). A film is a maker's output and takes its motion rules from [film.md](film.md), not from this section's limits.

## How this skill grows

A rule starts in the layer that first needs it. When a second layer needs the same rule, move it here and replace it in both layers with a pointer. A rule only one layer uses stays in that layer.

Changing this skill? Run `bash scripts/ci.sh` from the repo root. It runs `check-tokens.mjs` and the script tests of every layer: the templates of `arc-web-production` and `arc-salesforce-engineering`, the overlays of `arc-interaction`, `arc-realtime` and `arc-3d`, the page tests of `arc-html-response` and the inventory test of `arc-system-architecture`. Then run the fresh-agent gate of every layer whose behaviour the change touches (`arc-html-response/tests/fresh-agent.md`, `arc-web-production/tests/fresh-agent.md`).
