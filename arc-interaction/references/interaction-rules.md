# Interaction rules

Read this before writing a gesture. Each rule names the file in `overlay/` that shows it. The rules for the Model, `update`, Commands and `view` are in `arc-web-production/references/foldkit-rules.md` and still hold. This file adds what a gesture needs.

## The three cases

Level 3 is for the three things CSS keyframes can't do. Name the case in one sentence before writing code.

| Case | Why CSS can't | In the overlay |
|---|---|---|
| A drag or swipe that carries its velocity | A keyframe has a fixed start, end and duration. A release has a position and a speed nobody knew in advance. | `src/interaction/swipe.ts` |
| A layout move | CSS can't animate an element from the place it had before a DOM change to the place it has after. | `src/interaction/layout.ts` |
| A spring the user can interrupt | A CSS animation can't be stopped mid-flight and handed to a pointer at its current position and speed. | `settle` and `onDown` in `swipe.ts` |

Everything else is level 2: a CSS transition or keyframe on `--t-micro`, `--t-state`, `--t-enter`, `--stagger` and `--ease`, inside the reduced-motion guard. A hover, a fade, an entrance, a state badge.

## What this level is not for

- Scroll-driven animation. Nothing moves because the page scrolled.
- Text effects. No letters that fly, type themselves or shimmer.
- Hover springs. A hover is a CSS transition on `--t-micro`.
- Animation that shows no state change. If nothing in the Model changed and the user isn't moving the element, nothing moves.

The empty-state figure answers the pointer. That is the package's own behaviour, it rests under reduced motion, and it is the only exception. Don't use it as a reason for a second one.

## File shape

The overlay adds these files to the template's split. Keep the split.

| File | Holds |
|---|---|
| `src/interaction/constants.ts` | Every spring and gesture number, named, each with the reason it exists. |
| `src/interaction/motion.ts` | The only file that imports Motion. `springTo`, `exitTo`, `place`, `offsetOf`, `prefersReducedMotion`. |
| `src/interaction/swipe.ts` | Swipe to dismiss as plain DOM code, plus two pure functions: `velocityOf` and `decideRelease`. |
| `src/interaction/layout.ts` | The layout move (FLIP) as plain DOM code. |
| `src/interaction/figure.ts` | The empty-state figure. |
| `src/mounts.ts` | Every Mount. The only file that joins DOM code to Messages. |
| `src/interaction.css` | The swipe row, the list, the figure's token mapping. Loaded from `entry.ts`. |
| `scripts/check-interaction.mjs` | `npm run lint:interaction`. Fails on a rule below that a style lint can't see. |
| `scripts/browser-check.mjs` | `npm run browser:check`. The real-browser proof. |
| `test/interaction.test.ts` | Story, Scene and pure-function tests. |

The files in `src/interaction/` import no Foldkit and no Effect. That keeps the Mounts thin, and it lets `velocityOf` and `decideRelease` run in a Node test. Every file except `entry.ts` still imports cleanly in Node: `motion` 14.14.0 and `@lucasmarkes/hairline` 0.5.1 were both imported in Node 26 with no error.

## The Model stays the truth

- **A gesture ends in one past-tense Message.** `SwipedAwayNote({ noteId })` says the row has left the screen. It doesn't say "remove". `update` decides that it means a removal (`startRemove` in `src/main.ts`).
- **The DOM position during a drag is the only state outside the Model.** It lives in a closure in `swipe.ts`, exists only while the element does, and nothing else reads it. The Model never holds an x offset, a velocity or a "dragging" flag.
- **A gesture is never the only way.** Each row has a labelled Remove button that sends `ClickedRemove`. Both Messages reach the same branch of `update`, so a keyboard, a screen reader and a swipe do the same thing. Tests find the button by role and label.
- **`update` guards the double.** A swipe and a click on the same row send one request. A Message for a note that isn't loaded sends none.
- **The write follows the template's rules.** A removal is a write on an existing item. Its key is the note's id, the request is `DELETE /api/notes/:id`, and a repeat answers 200. It has a phase union (`Removing`, `Removed`, `Failed`) in a list keyed by that id. The row hides while `Removing`. `Removed` stays hidden until a list load no longer shows the note. `Failed` puts the row back with the reason, Retry and Keep.

## Mounts

- **One way in.** Motion and pointer code enter the view only as `h.OnMount(Definition(args))`. `view` stays pure. `npm run lint:interaction` fails when a file other than `motion.ts` imports Motion.
- **Build the resource inside `Effect.acquireRelease`.** The acquire is `Effect.sync(() => attachSwipe(element, ...))` and its success value is the function that detaches. The release calls it. Listeners, observers and running animations all stop when the element leaves. The lint fails a Mount with no `acquireRelease`.
- **`Mount.define` for setup, `Mount.defineStream` for a gesture.** `MoveRows` and `DrawEmptyFigure` set something up and report once (`Completed...`). `SwipeNote` is a stream, because the swipe may come at any time or never.
- **Give a stream Mount a first Message that changes nothing.** `SwipeNote` sends `CompletedAttachSwipe` when it starts listening. A Scene must resolve every Mount it renders before its next step, with one of that Mount's Messages. If the only Message removed a note, every scene with a row in it would have to remove that note. See [testing.md](testing.md).
- **Type the stream by its own Messages**: `Stream.callback<typeof Message.A.Type | typeof Message.B.Type>`. Typed as the whole `Message` union, it doesn't compile.
- **Args are read once.** `noteId` and `label` are captured at mount. A Model change never reaches a mounted element through args.
- **One transform per element.** The list's layout move shifts the `li`. The swipe shifts a `div.swipe` inside it. Two Mounts that both write `transform` on one element overwrite each other.
- **Not handled:** Foldkit passes each Mount a `viewStateChanges` stream for DevTools time travel. The overlay ignores it. An app that turns time travel on should stop its gestures while the view is `Paused`.

## Motion in a Foldkit Mount

Motion's plain `animate()` (the `motion` package, never `motion/react`) works inside a Mount. Proven on `motion` 14.14.0, `foldkit` 0.171.0 and Chromium 152. `scripts/browser-check.mjs` shows a spring started in a Mount running frame by frame, and the end of an exit reaching the Model as a Message and the API as one `DELETE`. A one-off probe, not kept in the overlay, showed the `acquireRelease` release running when the element left the DOM.

What the tests found. Each of these cost time and none is in Motion's type files:

| Finding | What the overlay does |
|---|---|
| `animate()` ignores `prefers-reduced-motion` by default. The option `reduceMotion` reads "undefined: use device preference", but with the setting on and no option, the spring ran in full. | `motion.ts` checks the media query before every animation. When it is on, it sets the end place at once and never calls `animate()`. |
| `animate(el, { x: 0 })` starts from Motion's own record of the element, not from a transform set by hand during a drag. | Every call passes both ends: `{ x: [from, to] }`. |
| `stop()` leaves the element at the spring's value for that instant. | A second touch calls `stop()`, reads the place with `offsetOf`, and starts the drag from it. |
| `velocity` is in px per second and its sign is the direction. | `velocityOf` returns the same unit, so the release passes it straight in. |
| A finished animation leaves an inline `transform: none`. | Harmless. The browser check accepts `none` or empty. |
| `motion` lists React as an optional peer. | React is not installed. The overlay test fails if `node_modules/react` exists. |

Unverified, so check the current docs before using them: the package also exports gesture and layout helpers (`drag`, `animateLayout`, `press`, `hover`). This skill has not tested them and the rule allows only `animate()`.

GSAP, anime.js, react-spring and every other animation library stay out. Motion's React API can't run in Foldkit, because there is no React. `npm run lint:interaction` fails on any of those imports.

## Spring and gesture numbers

They can't be CSS tokens. A spring has no duration to name. Its length comes from stiffness, damping and the speed the finger left it with. A threshold is a distance or a speed that script compares, and CSS never reads it. So they live in ONE module, `src/interaction/constants.ts`, each a named constant with a comment that says why it exists. The lint fails on `stiffness`, `damping` or `mass` with a number in any other file.

| Constant | Value | Why it exists |
|---|---|---|
| `SPRING` | stiffness 300, damping 30, mass 1 | The one spring, for going home and for a layout move. Damping sits just under critical (34.6), so a row at rest settles with no wobble and a row released with speed overshoots once. |
| `DRAG_SLOP_PX` | 8 | Below it a press is a tap and reaches the button. |
| `DISMISS_DISTANCE_RATIO` | 0.4 | Released further out than this share of the row's width, the row is dismissed at no speed. |
| `DISMISS_VELOCITY` | 500 px/s | Released faster than this, direction decides. Away dismisses, toward home returns. |
| `VELOCITY_WINDOW_MS` | 100 | Velocity is measured over the last 100 ms. A pointer that paused longer has none. |
| `EXIT_MIN_SPEED` | 1200 px/s | A dismissed row leaves at its release speed, never slower than this. |
| `EXIT_MARGIN_PX` | 24 | How far past its own width a dismissed row stops. |
| `LAYOUT_MIN_MOVE_PX` | 0.5 | A row that moved less is not animated. |

These are taste values, tuned by hand on a 358 px row. Change them in the one file. `scripts/browser-check.mjs` reads the same module, so its drags stay on the right side of each threshold.

## The swipe (`src/interaction/swipe.ts`)

1. **Press.** `pointerdown` on the primary button records the start. If a spring is in flight it stops it and takes the row over at once.
2. **Slop.** The row doesn't move until the pointer has gone `DRAG_SLOP_PX` sideways. A move that is more down than across is dropped.
3. **Capture.** At that point the row calls `setPointerCapture`, so it keeps the pointer outside its own box. It sets `data-dragging`, which the stylesheet uses for the cursor and to stop text selection.
4. **Follow.** Each `pointermove` writes `translateX` and records a sample for the velocity.
5. **Release.** `decideRelease(offset, velocity, width)` returns dismiss or return. Return is `springTo` home with the velocity. Dismiss is `exitTo` past the row's width at the release speed, then the callback, then the Message.
6. **Cancel.** `pointercancel` means the browser took the pointer for a scroll. The row goes home.

The stylesheet does three things the script relies on. `touch-action: pan-y` on `.swipe` lets the browser keep vertical scroll and hand sideways movement to the script. `overflow-x: clip` on the list stops a leaving row from widening the page. `min-height: 44px` keeps the row and its button a touch target.

A drag that starts on the Remove button must not end as a click, so a capture-phase listener drops the one click that follows a drag.

## The layout move (`src/interaction/layout.ts`)

FLIP: First, Last, Invert, Play.

- **First.** Each row's `offsetTop` is remembered from the last time the list changed.
- **Last.** A `MutationObserver` on the list's children runs after the DOM change and before the browser paints. It reads each row's new `offsetTop`.
- **Invert.** The row is shifted back by the difference with `translateY`, so the first frame painted looks unmoved.
- **Play.** `springTo` takes the shift to zero.

Why it holds up. `offsetTop` ignores transforms, so a row measured in the middle of a move reports its true place. The list is `position: relative`, so tops are measured from the list. A move interrupted by a second change starts from where the row is drawn. A new row has no First, so its CSS entrance plays and this code leaves it alone. A `ResizeObserver` refreshes the remembered tops when a row grows or shrinks.

Only place changes are animated. A row that changes size is not scaled.

## The empty-state figure (`src/interaction/figure.ts`)

One figure from `@lucasmarkes/hairline`, through its plain DOM entry: `drawer(host, { label })` returns `{ update, destroy }`. Never import `@lucasmarkes/hairline/react`. Its docs are at https://hairline.lucasmarkes.com/llms.txt and list 33 figures. Pick one whose rest pose shows the empty thing.

- **Colours come from tokens.** `src/interaction.css` sets all six properties on `.figure`: `--hairline-plate: var(--bg)`, `--hairline-hi: var(--fg)`, `--hairline-edge: var(--dim)`, `--hairline-mid: var(--dim)`, `--hairline-lo: var(--line)`, `--hairline-stroke: 0.9`. The plate must be the colour the figure sits on, because it hides the lines behind it. With all six set, the figure follows dark and light with no script.
- **The label is in the view too.** `view` sets `role="img"` and `aria-label` on the host, and passes the same text as `label`. So a Scene finds the figure by role and label with no DOM.
- **It rests under reduced motion.** The docs say every figure still answers the pointer under reduced motion. So the stylesheet sets `pointer-events: none` on `.figure` inside `@media (prefers-reduced-motion: reduce)`. `play` is left off.
- **Size.** The docs give 160 to 240 px for an empty state. The overlay uses 200 px. The figure is 5:4.
- **If the package won't install or mount**, leave the figure out and say so. The empty state still needs its sentence.

## Reduced motion

Under `prefers-reduced-motion: reduce`:

- The row still follows the finger. The user is moving it.
- A release ends at once. No spring, no fly-off. The row is home, or it is gone and the Message is sent.
- Rows jump to their new places. No layout move.
- The figure doesn't answer the pointer.

One function decides: `run` in `motion.ts`. It reads the media query at each animation, so a setting changed while the app is open takes effect.

## States

Every state has a screen. The template gives loading, empty, failure and stale. This level adds:

| State | What shows |
|---|---|
| Dragging | The row at the pointer, `data-dragging` set. |
| Returning | The row on its spring. A touch takes it over. |
| Leaving | The row on its way off. A press does nothing. |
| Removing, Removed | The row is hidden and its neighbours have closed the gap. |
| Removal failed | The row is back with "not removed", a sentence, Retry and Keep. |
| Empty | The figure, and the sentence that says how to add the first note. |

## Pitfalls

- **A Scene throws on an unresolved Mount.** Adding a Mount to a row breaks every existing scene that renders a row, until each resolves it. See [testing.md](testing.md).
- **A press that ends outside the row never sends `pointerup` to it**, when the drag had not begun. Don't refuse a new press because an old pointer id is still set.
- **`Enter` in the same frame as typing does nothing.** The Add button is still disabled until the next render, and a disabled submit button blocks the form. A browser test must click Add, which waits, or wait for the button.
- **A release while the pointer is still moving is a flick.** A test of "slow drag" must pause longer than `VELOCITY_WINDOW_MS` before it lets go.
- **`import "./interaction.css"` needs `src/css.d.ts`.** TypeScript 7 rejects a side-effect import it can't resolve.
- **`npm run lint:styles` only reads the files it is given.** The overlay's script adds `src/interaction.css` to it. A new stylesheet needs the same.
- **The style lint knows one reduced-motion guard per file.** A second `@media (prefers-reduced-motion: no-preference)` block in the same stylesheet is reported as outside the guard. Keep one guard per file, or put the new rules in their own file.

## Version notes

- `motion` 14.14.0 re-exports `framer-motion/dom`. `animate()` returns a `Timeline` with `stop`, `finished` and `then`.
- `@lucasmarkes/hairline` 0.5.1 is ESM only, has no dependencies, and marks React as an optional peer.
- With `vite build` (Vite 8.3.8), the template's script is 347 kB (115 kB gzip) and the overlay's is 444 kB (150 kB gzip). Motion's `animate()` and one figure add 97 kB (35 kB gzip). Which of the two adds how much is unknown, because they were not measured apart.
