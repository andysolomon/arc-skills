---
name: arc-design
description: The shared design rules above the arc response and build skills. Picks the layer a request belongs to (static page, web app, Salesforce, system architecture) and holds the one look every layer uses - colour tokens, type, motion timings, taste rules. Use when asked to design, restyle or polish a page or app, to decide between a page, a prototype and a production app, or when a layer skill (arc-html-response, arc-web-production) says to load it. Holds no components or code of its own.
---

# Design

The top of an upside-down pyramid. Each layer below builds one kind of thing; this skill keeps them looking and behaving like one system.

| Layer | Builds | Status |
|---|---|---|
| `arc-html-response` | A static page: answers, reports, write-ups. No script. | built |
| `arc-web-production` | A web app that lasts: Foldkit on Effect, deployed with Alchemy. | built |
| `arc-salesforce-engineering` | Screens and configuration inside a Salesforce org. | planned |
| `arc-system-architecture` | Where things run: stacks, clusters, tunnels. | planned |

## Steps

1. **Pick the layer.** Ask in order and stop at the first yes. Choose the lowest layer that serves the request.
   1. Is it an answer, a report or a write-up that nobody types into? `arc-html-response`.
   2. Does someone type into it, or must it keep working after today? `arc-web-production`. It picks its own rung (static render, Lakebed prototype, full app).
   3. Does it run inside a Salesforce org, or change an org's configuration? `arc-salesforce-engineering`. Until that skill exists, say so, and build any web screen with `arc-web-production`'s rules and the host exception below.
   4. Is the question where and how things run? `arc-system-architecture`. Until that skill exists, say so and answer with a page.

   Completion: one sentence names the layer and the question that chose it.
2. **Load that layer's skill** and follow it. Completion: the layer skill's own steps are done.
3. **Apply the look.** Use [tokens.css](tokens.css) as the only source of colours, fonts and timings. Completion: the work has no colour or duration that isn't a token, and `node <skill-dir>/scripts/check-tokens.mjs <copy>` passes for every copied token file.
4. **Check the taste rules and motion rules below** against the finished work. Completion: each rule holds, or the reply says which one doesn't and why.

## The look

- **Dark first.** True black page, white text, dark grey only for secondary surfaces. Light mode through `prefers-color-scheme`.
- **One accent**, the token `--hi` (pink). Green, red and yellow are for status only: pass, fail, warn.
- **Text on the accent** uses `--on-hi`, never a guessed black or white.
- **System fonts only**: the `--sans` and `--mono` stacks. No web fonts.
- **Host exception.** A screen that runs inside another product takes that product's accent so it matches its host: inside a Salesforce org, `--hi` is Salesforce blue `#0176d3` and `--on-hi` is white. Type, spacing, status colours and motion stay the same.
- **Copies must match.** A layer that needs the tokens copies `tokens.css` whole. It never edits the copy.

## Taste rules, every layer

- **Answer first.** The headline or the first screen says the main point, not the topic.
- **Real data only.** A value you don't have is written as unknown, never invented.
- **Draw the mechanism, not decoration.** No stock icons, ornamental gradients or card chrome.
- **A picture of one of our own apps comes from the real app**: its static render, or a capture of its running screen. A hand-built or faux UI is only for an interface that doesn't exist yet.
- **Every state has a screen.** Loading, empty, failure and stale each show something specific. Empty says how to add the first item. Failure says what to do next. Stale keeps the last good data visible.
- **Plain words.** Error text is a sentence a non-engineer can act on. Technical causes go to logs and tests.
- **Every control has a label**, and tests find controls by role and label.
- **Phone first.** Works at 390 px: one column, 16 px side gutter, no sideways page scroll, touch targets at least 44 px tall.
- **Numbers** use tabular figures. Body text stays near 65 characters a line.
- **Say what was not verified.** A check is `PASS`, `FAIL` or `NOT_RUN`, in those literal words. A check proves only what it exercised.

## Motion, every layer

- **Motion shows meaning**: a state changed, an order, a direction, a size. No decorative loops, no text effects.
- **CSS only.** No animation library (GSAP, Motion). If a request truly needs one, say so and ask before adding it.
- **Use the timing tokens**: `--t-micro` for hover, `--t-state` for a state change, `--t-enter` for an entrance, `--stagger` between items, with `--ease`.
- **Inside `@media (prefers-reduced-motion: no-preference)`**, always.
- **Animate from the start state** (`animation-fill-mode: backwards`), on `transform` and `opacity`, each animation under one second. The resting frame, which is what a screenshot or reduced motion shows, must tell the story on its own.
- **In an app, give each state its own `@keyframes` name.** A class change restarts an animation only when the animation name changes. One shared name plays once and never again.
- **On a page, one entrance moment**, and never on the headline or the first paragraph.
- **No scroll-driven animation.**

## How this skill grows

A rule starts in the layer that first needs it. When a second layer needs the same rule, move it here and replace it in both layers with a pointer. A rule only one layer uses stays in that layer.

Changing this skill? Run `node <skill-dir>/scripts/check-tokens.mjs`, then the release gate of every layer whose behaviour the change touches (`arc-html-response/tests/fresh-agent.md`, `arc-web-production/tests/test-template.sh`).
