# Scene rules

Read this before writing a scene. Each rule names the file in `overlay/` that shows it. The Foldkit rules in `arc-web-production/references/foldkit-rules.md` still apply; these sit on top.

## File shape

| File | Holds |
|---|---|
| `src/scene/data.ts` | What the scene draws, as plain values: `barsOf(model)`, the layout, the canvas label, the render gate. Pure. No DOM, no three.js. |
| `src/scene/model.ts` | The scene's Model (`isShown`, `status`, `turns`) and its Messages. |
| `src/scene/tokens.ts` | The one mapping from design tokens to scene colours and timings. |
| `src/scene/handle.ts` | The type of the running scene, and a `WeakMap` from the canvas element to it. |
| `src/scene/scene.ts` | three.js. The only file that imports `three`. Loaded on demand. |
| `src/scene/mount.ts` | The Mount. It builds the scene and its watchers, and disposes them. |
| `src/scene/commands.ts` | `DrawBars` and `TurnScene`. Each carries a Model change to the running scene. |
| `src/scene/view.ts` | The canvas, the controls, the legend, the table, and every state's screen. |
| `src/scene/scene.css` | Styles for that HTML. Tokens only. |
| `src/app.ts` | Wraps the template's program. It adds the `scene` field, ends `update` with `redraw`, and puts the scene under the notes. |
| `src/entry.ts` | Boots `app.ts` and imports `scene.css`. The one template file the overlay replaces. |
| `scripts/check-scene.mjs` | The scene lint (`npm run lint:scene`). |
| `test/scene.test.ts` | Story and Scene tests. Run with `node`, no browser. |
| `test/scene.browser.mjs` | The real-browser test. |

Everything except `scene.ts` and `entry.ts` imports cleanly in Node. `scene.ts` is reached only through `import("./scene.ts")` in the Mount, so the Node tests never load three.js and Vite puts it in its own chunk.

**In your own app** you don't need the wrapper. Do the same three things in your own `main.ts`: add a `scene` field to the Model, end `update` with `redraw(before, result)`, and call `sceneView(model, h)` from `view`. The overlay wraps so that the template's files stay untouched and can't drift.

## The data comes first (`src/scene/data.ts`)

- **Write what the scene draws as a list of plain values**, derived from the Model by a pure function. The overlay's is `barsOf(model)`, which returns one `Bar` per note with its id, text, length and state.
- **The view, the Commands, the scene and the table all read that one list.** The canvas label (`describe`) and the scale caption (`scaleText`) come from it too. So the picture, the label and the table can't disagree.
- **Layout is pure too.** `layoutOf` says where each mark stands, in world units. The scene draws the layout and decides nothing about the data.
- **Never invent a field to have something to draw.** The template's notes have no timestamp, so the overlay places bars by write order, which the API does give. It does not make up dates.

## The Mount (`src/scene/mount.ts`)

- **`Mount.defineStream`**, because the canvas reports more than once: started or failed, then context lost and restored. A scene that reports once and never again can use `Mount.define`.
- **Build every resource inside `Effect.acquireRelease`, in the acquire body.** The overlay has two. The first loads `scene.ts` and calls `startScene`, which builds the renderer, the geometries and the materials. Its release calls `dispose`. The second adds the watchers (a ResizeObserver, an IntersectionObserver, a MutationObserver and four event listeners) and its release removes them. Releases run in reverse, so the watchers go before the scene.
- **Pass `{ interruptible: true }`** to the acquire that waits for the chunk, and construct the scene after the wait. An unmount during the download then leaves nothing to release.
- **Never build the renderer before `acquireRelease`** and hand it in. An interrupt between the two leaks a WebGL context.
- **Args are read once, at mount.** Name them `initial…`. The canvas is keyed (`h.keyed("canvas")`), so it keeps its DOM node, and its Mount, across renders.
- **Probe before you download.** `hasWebGL2` asks a throwaway canvas for a `webgl2` context and gives it back. three.js 0.187 asks only for `webgl2` (checked in its `WebGLRenderer.js`), so without one the Mount reports `FailedStartScene` and three.js is never fetched.
- **Turn every start failure into a Message** (`Effect.result`, then `FailedStartScene`). A failed import, a missing token and a renderer that throws all end on the fallback screen.
- **Follow `viewStateChanges`.** Foldkit's time travel installs a historical view while the app keeps running. The Mount forwards `Live` or `Paused` to the scene, and the scene stops drawing while paused.

## Model changes reach the scene by Command (`src/app.ts`, `src/scene/commands.ts`)

- **A later render never re-runs the Mount.** So `update` returns a Command for every change to the picture. Foldkit's Mount docs say the same. The Message that changed the Model is the cause, and its handler dispatches the Command.
- **`redraw(before, result)` does it in one place.** After any Message it compares `barsOf` before and after. If they differ and a scene is running, it appends `DrawBars({ bars })`. It is pure. Two Models go in and a value comes out.
- **The Command finds the scene through `handle.ts`.** The Mount registers its handle under the canvas element in a `WeakMap` and removes it on release. That map holds a resource, not app state, and it can't keep a removed canvas alive.
- **When the Mount reports `StartedScene`, send the current data again.** The args are as old as the render that placed the canvas. Notes that loaded during the download would otherwise be missing.
- **A Command with no scene to talk to does nothing and says so** (`CompletedDrawBars({ drawn: false })`). `update` doesn't send one while the scene is hidden, loading, lost or unavailable.
- **The scene ignores a value it already shows** (`sameBars`, the same turn). A no-op change draws no frame.

## Colours and timings come from the tokens (`src/scene/tokens.ts`)

- **A shader can't read `var(--c1)`.** `readTokens` sets each token as the `color` of a hidden probe element and reads the computed value back. The browser resolves the syntax and the active colour scheme, and answers in `rgb()`.
- **Read at mount, and again when the scheme changes.** The watchers listen to `prefers-color-scheme` and to the `data-theme` attribute on `<html>`, which is how `arc-design` forces dark.
- **One module, no literals.** No other scene file names a colour. `npm run lint:scene` fails on a hex string, a `0x` number, a colour function, a colour name, `setHex`, `setStyle` and `new Color(<value>)`.
- **The mapping, written once** in the `Palette` type: `--bg` clears the canvas, `--line` is the slot grid, `--dim` the floor frame, `--fg` the height scale, `--hi` the draft outline, `--c1` to `--c4` the bar states.
- **Colours cross as sRGB.** `paint` calls `Color.setRGB(r, g, b, SRGBColorSpace)`, and the renderer's output is sRGB, so an unlit face comes out as the token value. The browser test measures that.
- **Unlit materials for data colours.** A lit material changes the colour with the angle, and then a bar no longer matches its legend swatch. The overlay shades faces with fixed multipliers instead.
- **Values CSS can't express live here too.** `SHADE` holds the face multipliers (top 1, side 0.78, front 0.6). They are numbers, not colours. A shader uniform that is not a colour (a noise scale, a line width) goes in this module, next to them.
- **Timings are tokens.** `--t-enter` times a bar growing in, `--t-state` a turn, and `--ease` is parsed into the easing function. A token that doesn't parse gives 0 ms or a linear ease, never an invented number.
- **A custom shader gets the same Palette as uniforms.** Set each uniform from the Palette in `applyPalette`, and convert with the same `paint` helper. The overlay has no custom shader, so that path is `NOT_RUN` here.

## The render loop (`src/scene/scene.ts`)

- **Render on demand.** `invalidate()` asks for one frame. The loop keeps running only while a transition is in flight. An idle scene draws nothing.
- **The gate is a pure function** (`canRender` in `data.ts`): on screen, tab visible, view live, context present. Any one of them false stops the loop and cancels the pending frame. When the gate opens, one frame is drawn, so the scene catches up on what changed.
- **Resize follows the element.** A ResizeObserver on the canvas calls `resize`, which reads `clientWidth` and `clientHeight` and calls `renderer.setSize(width, height, false)`. The `false` leaves the CSS size to the stylesheet. `setSize` clears the buffer, so `resize` draws in the same task.
- **Cap the pixel ratio** at `MAX_PIXEL_RATIO` (2). A 3x screen gets a 2x buffer.
- **Reduced motion is one frame.** At the start of each transition the scene asks `prefers-reduced-motion`. When it is `reduce`, progress starts at 1, so the change is drawn once and the loop stops.
- **Motion shows meaning.** A bar grows in when its note is added and slides when its state changes lane. The view turns when a turn button is pressed. Nothing spins on its own.
- **Report what the loop does.** The scene writes `data-scene-state` (`idle`, `animating`, `stopped`, `lost`, `disposed`) and `data-scene-frames` on the canvas. The browser test reads them, and so can `arc-webgl-performance`.
- **Instance what repeats.** One `InstancedMesh` draws every bar in one call. When it must grow, dispose the old one first.
- **`dispose` frees what `startScene` built.** Every geometry, every material, the instanced mesh, then `renderer.dispose()` and `renderer.forceContextLoss()`. A browser limits how many WebGL contexts a page may hold (the number is not checked here), so give this one back at once.

## Every state has a screen (`src/scene/view.ts`)

| State | What shows |
|---|---|
| Hidden | The heading and a "Show chart" button. No canvas, so no renderer. |
| Loading | The canvas, and over it "Loading the chart…". The cause is real. The chunk is downloading. |
| WebGL not available | No canvas. A sentence, then the same notes as a table. |
| Context lost | The canvas stays, because the browser restores into it. Over it, a sentence that says it restarts by itself. Controls are off. |
| Notes loading, notes failed | The canvas, and over it the reason there is nothing to draw. |
| Empty | The canvas, and over it how to add the first note. |
| Stale | The last good notes stay drawn, and a line under the stage says they are old. |
| Ready | The picture, the controls, the legend, and the table inside a `<details>`. |

Screen text is a sentence a person can act on. The technical reason (`no WebGL 2 context`) stays in the Model for tests and DevTools.

## Accessibility (`src/scene/view.ts`)

- **Text stays HTML.** Labels, legend, scale caption and numbers are elements around the canvas. No canvas text, no text texture, no text geometry. The lint fails on `fillText`, `CanvasTexture` and `TextGeometry`.
- **The canvas is one image.** It has `role="img"` and an `aria-label` that says what it shows and how many marks, from `describe(bars)`.
- **The same data is reachable as HTML.** It is a table with a caption and column headers, one row per mark.
- **Colour is never the only signal.** The overlay shows a note's state by colour and by lane, and the table says it in words.
- **Every control is a `<button>` with a text label**, so Enter and Space work with no extra code. Controls are off while there is no picture to move.
- **Scene controls are quiet.** They use `--surface`, so the accent stays with the app's main action.
- **Pointer orbit is extra, never the only way.** If you add drag to rotate, keep the buttons.

## Tests

| Test | Proves | Does not prove |
|---|---|---|
| Story (`test/scene.test.ts`) | Each change to the picture leaves `update` as a Command with the right bars. Nothing is sent while no scene runs. | That the Command's body draws. |
| Scene (`test/scene.test.ts`) | The Mount is on the canvas with its args. Each state renders its screen. Controls are found by role and label. | Anything the Mount does to the element. Scene has no DOM. |
| Data and tokens (`test/scene.test.ts`) | The bar order, the layout, the gate, the token parsers. | That the browser computes those token values. |
| Browser (`test/scene.browser.mjs`) | See below. | Frame rate. |

The browser test drives the built app (`vite preview`) and the mock API with `playwright-core`, and reads pixels from screenshots of the canvas.

- **Non-blank pixels.** More than half the canvas is `--bg`, and more than 1000 pixels are not.
- **Token colours, both schemes.** The expected values are parsed from `src/tokens.css` on disk, not asked from the browser. Filled faces must match within 2 per channel. One-pixel lines are antialiased, so the test asks only for a pixel nearer the token than the background.
- **Adding a note changes the picture.** The test holds the save, then fails it, then retries. It sees the bar as `--c2`, `--c4`, `--c3` and `--c1` in turn.
- **The fallback**, two ways. The test page makes `HTMLCanvasElement.prototype.getContext` answer `null` with `addInitScript`. That works in any Chromium. It also starts a browser with `--disable-gpu --disable-software-rasterizer`, which gave no WebGL 2 context in Chromium 152 here. `--disable-gpu` alone is not enough: Chromium then draws WebGL in software (SwiftShader).
- **Disposal.** After "Hide chart" the old canvas is out of the page, three.js reports 0 geometries, and `getContext("webgl2").isContextLost()` is true.
- **The other checks.** Keyboard control, resize, off screen, hidden tab, context lost and restored (through `WEBGL_lose_context`), the 2x cap on a 3x screen, 390 px with no sideways scroll, reduced motion, no page errors.
- **Compare pictures by a small copy, not by exact pixels.** The canvas sits at a fractional offset, so edge pixels move with the scroll position. The test shrinks each shot to 32 by 20 and compares those. The same picture measured under 0.01 apart; a turned view about 7.
- **`SHOT=<file.png>`** keeps the last canvas screenshot when the test fails.

A paused Foldkit view (time travel) is not proven in a browser anywhere here. The template does not ship `@foldkit/devtools`, so nothing can pause the view. The gate's `live` flag is tested in Node only.

## Pitfalls

Each of these cost time while building the overlay.

- **A view builder belongs to one Message set.** `HtmlBuilder<Message>` is invariant, so the template's `view` can't take the wrapper's builder. Embed it with `h.submodel` and `Submodel.defineView`. When every child Message is also a parent Message, `toParentMessage` is the identity.
- **A Document's title can't cross that boundary.** `app.ts` repeats the template's title rule. Change both together.
- **`import "./scene.css"` needs a declaration.** TypeScript 7 rejects a side-effect import it can't resolve. `src/scene/css.d.ts` declares `*.css`.
- **A `data-*` attribute the scene writes survives renders.** In the browser test the canvas kept `data-scene-frames` across many Foldkit renders, so the scene can report on its own element.
- **Exact-pixel comparisons flake.** See the small-copy rule above.
- **`--disable-gpu` does not remove WebGL.** See the fallback rule above.
- **The first chunk barely grows.** In the overlay's build the app chunk went from 347 kB to 364 kB, and three.js is a separate 538 kB chunk (134 kB gzipped, by Vite's report) that loads only when the canvas mounts. Vite warns about a chunk over 500 kB; that warning is this chunk.
