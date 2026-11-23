/**
 * Scene tests with no browser and no GPU. Run: node test/scene.test.ts
 *
 * Story drives `update`: a Model change must leave as a Command, because the Mount reads
 * its args once. Scene drives `view`: the Mount is present, and every state has its
 * screen. Neither test runs three.js. What the canvas shows is test/scene.browser.mjs.
 */
import assert from "node:assert/strict"
import { Option } from "effect"
import { AsyncData, Scene, Story } from "foldkit"
import { emptyApp, init, type Model, update, view } from "../src/app.ts"
import { FetchNotes, MintRequestId, SaveNote } from "../src/commands.ts"
import { Message as NotesMessage } from "../src/model.ts"
import { DrawBars, TurnScene } from "../src/scene/commands.ts"
import { barsOf, canRender, layoutOf, tickStep } from "../src/scene/data.ts"
import { SceneMessage, SceneStatus } from "../src/scene/model.ts"
import { HostScene } from "../src/scene/mount.ts"
import { parseEase, parseMs, parseRgb } from "../src/scene/tokens.ts"

const KEY = "11111111-aaaa-4bbb-8ccc-000000000001"
const NOTES = [{ id: "n2", text: "second" }, { id: "n1", text: "first note" }] // newest first, as the API answers
const loading: Model = { ...emptyApp, notes: AsyncData.Success({ data: NOTES }), draftRequestId: Option.some(KEY) }
const ready: Model = { ...loading, scene: { ...loading.scene, status: SceneStatus.Ready() } }
const drawn = SceneMessage.CompletedDrawBars({ drawn: true })
const turned = SceneMessage.CompletedTurnScene({ drawn: true })

// DATA ------------------------------------------------------------------------

assert.deepEqual(barsOf(ready).map((b) => [b.id, b.chars, b.state]), [["n1", 10, "stored"], ["n2", 6, "stored"]])
assert.deepEqual(layoutOf(barsOf(ready)).slots.map((s) => s.x), [-0.5, 0.5])
assert.deepEqual([3, 9, 55, 2000].map(tickStep), [1, 2, 20, 500])
console.log("ok  data: bars run oldest to newest, the layout is centred, ticks are round steps")

const open = { onScreen: true, tabVisible: true, live: true, contextLost: false }
assert.equal(canRender(open), true)
for (const closed of [{ onScreen: false }, { tabVisible: false }, { live: false }, { contextLost: true }]) assert.equal(canRender({ ...open, ...closed }), false)
console.log("ok  gate: off screen, a hidden tab, a paused view or a lost context each stop the loop")

assert.deepEqual(parseRgb("rgb(255, 46, 147)"), [255, 46, 147])
assert.equal(parseRgb("color(display-p3 1 0 0)"), undefined)
assert.deepEqual([parseMs("220ms"), parseMs(" 0.5s"), parseMs("fast")], [220, 500, 0])
const ease = parseEase("cubic-bezier(.2,.7,.2,1)")
assert.deepEqual([ease(0), ease(1)], [0, 1])
assert.ok(ease(0.5) > 0.8 && ease(0.5) < 1, "the token easing is fast first, slow last")
assert.equal(parseEase("ease-out")(0.3), 0.3)
console.log("ok  tokens: computed colours, durations and the easing parse; unknown values fall back")

// UPDATE ----------------------------------------------------------------------

assert.deepEqual(init().commands?.map((c) => c.name), ["MintRequestId", "FetchNotes"])
assert.equal(init().model.scene.status._tag, "Loading")

Story.story(
  update,
  Story.given(loading),
  // The scene started. Its Mount args may be stale, so the current data is sent again.
  Story.message(SceneMessage.StartedScene()),
  Story.Command.expectExact(DrawBars({ bars: barsOf(loading) }), TurnScene({ turns: 0 })),
  Story.Command.resolve(DrawBars, drawn),
  Story.Command.resolve(TurnScene, turned),
  Story.model((m) => assert.equal(m.scene.status._tag, "Ready")),
  // Typing draws the draft.
  Story.message(NotesMessage.ChangedDraft({ text: "buy milk" })),
  Story.Command.expectExact(DrawBars({ bars: [...barsOf(loading), { id: "draft", text: "buy milk", chars: 8, state: "draft" }] })),
  Story.Command.resolve(DrawBars, drawn),
  // Adding the note changes the scene through a Command, next to the save itself.
  Story.message(NotesMessage.SubmittedNote()),
  Story.Command.expectExact(SaveNote({ requestId: KEY, text: "buy milk" }), MintRequestId, DrawBars({ bars: [...barsOf(loading), { id: KEY, text: "buy milk", chars: 8, state: "saving" }] })),
  Story.Command.resolve(DrawBars, drawn),
  Story.Command.resolve(MintRequestId, NotesMessage.MintedRequestId({ requestId: "next-key" })),
  Story.Command.resolve(SaveNote, NotesMessage.SucceededSaveNote({ requestId: KEY })),
  Story.Command.expectExact(DrawBars),
  Story.Command.resolve(DrawBars, drawn),
  Story.model((m) => assert.equal(barsOf(m).at(-1)!.state, "saved")),
  // The list load that includes the note moves its bar to the stored lane.
  Story.message(NotesMessage.TickedRefresh()),
  Story.Command.resolve(FetchNotes, NotesMessage.SucceededFetchNotes({ notes: [{ id: KEY, text: "buy milk" }, ...NOTES] })),
  Story.Command.expectExact(DrawBars),
  Story.Command.resolve(DrawBars, drawn),
  Story.model((m) => assert.deepEqual(barsOf(m).map((b) => b.state), ["stored", "stored", "stored"]))
)
console.log("ok  story: start, a draft, an added note and a list load each reach the scene as a DrawBars Command")

Story.story(
  update,
  Story.given(ready),
  // A tick that changes nothing the scene shows sends nothing to it.
  Story.message(NotesMessage.TickedRefresh()),
  Story.Command.expectExact(FetchNotes),
  Story.Command.resolve(FetchNotes, NotesMessage.SucceededFetchNotes({ notes: NOTES })),
  Story.Command.expectNone()
)
console.log("ok  story: a reload with the same notes does not redraw")

for (const [name, model] of [["loading", loading], ["hidden", { ...ready, scene: { ...ready.scene, isShown: false } }]] as const) {
  Story.story(update, Story.given(model), Story.message(NotesMessage.ChangedDraft({ text: "x" })), Story.Command.expectNone())
  Story.story(update, Story.given(model), Story.message(SceneMessage.ClickedTurnScene({ by: 1 })), Story.Command.expectNone(), Story.model((m) => assert.equal(m.scene.turns, 0)))
  console.log(`ok  story: while the scene is ${name}, nothing is sent to it`)
}

Story.story(
  update,
  Story.given(ready),
  Story.message(SceneMessage.ClickedResetScene()),
  Story.Command.expectNone(),
  Story.message(SceneMessage.ClickedTurnScene({ by: 1 })),
  Story.Command.expectExact(TurnScene({ turns: 1 })),
  Story.Command.resolve(TurnScene, turned),
  Story.message(SceneMessage.ClickedTurnScene({ by: 1 })),
  Story.Command.expectExact(TurnScene({ turns: 2 })),
  Story.Command.resolve(TurnScene, turned),
  Story.message(SceneMessage.ClickedResetScene()),
  Story.Command.expectExact(TurnScene({ turns: 0 })),
  Story.Command.resolve(TurnScene, turned),
  Story.model((m) => assert.equal(m.scene.turns, 0))
)
console.log("ok  story: turn and reset change the Model and send TurnScene; a reset at the start sends nothing")

Story.story(
  update,
  Story.given(ready),
  Story.message(SceneMessage.LostSceneContext()),
  Story.model((m) => assert.equal(m.scene.status._tag, "Lost")),
  Story.message(SceneMessage.RestoredSceneContext()),
  Story.Command.expectExact(DrawBars({ bars: barsOf(ready) })),
  Story.Command.resolve(DrawBars, drawn),
  Story.model((m) => assert.equal(m.scene.status._tag, "Ready")),
  Story.message(SceneMessage.FailedStartScene({ reason: "no WebGL 2 context" })),
  Story.model((m) => assert.deepEqual(m.scene.status, SceneStatus.Unavailable({ reason: "no WebGL 2 context" }))),
  // Hiding and showing starts over at Loading: the next canvas gets a new Mount.
  Story.message(SceneMessage.ClickedToggleScene()),
  Story.message(SceneMessage.ClickedToggleScene()),
  Story.model((m) => assert.deepEqual(m.scene, { isShown: true, status: SceneStatus.Loading(), turns: 0 }))
)
console.log("ok  story: context lost and restored, a failed start, hide and show")

// VIEW ------------------------------------------------------------------------

const LABEL = "Chart of notes in the order they were written, oldest on the left. 2 bars. Bar height is the number of characters, up to 10."
const status = Scene.role("status", { name: "Chart status" })
const start = Scene.Command.resolveAll([DrawBars, drawn], [TurnScene, turned])

Scene.scene(
  { update, view },
  Scene.given(loading),
  // Loading: the canvas is in the page with its Mount, and the screen says so.
  Scene.Mount.expectHas(HostScene({ initialBars: barsOf(loading), initialTurns: 0 })),
  Scene.expect(Scene.role("img", { name: LABEL })).toExist(),
  Scene.expect(status).toHaveText("Loading the chart…"),
  Scene.expect(Scene.role("button", { name: "Turn right" })).toBeDisabled(),
  // Ready: the note goes away and the controls work. Each control is a labelled button.
  Scene.Mount.resolve(HostScene, SceneMessage.StartedScene()),
  start,
  Scene.expect(status).toBeAbsent(),
  Scene.expect(Scene.role("button", { name: "Reset view" })).toBeDisabled(),
  Scene.click(Scene.role("button", { name: "Turn right" })),
  Scene.Command.resolve(TurnScene, turned),
  Scene.expect(Scene.role("button", { name: "Reset view" })).toBeEnabled(),
  Scene.click(Scene.role("button", { name: "Turn left" })),
  Scene.Command.resolve(TurnScene, turned),
  // The same data is HTML: one table row per bar.
  Scene.expect(Scene.role("table", { name: "Notes in the order they were written, oldest first" })).toExist(),
  Scene.expectAll(Scene.all.role("row")).toHaveCount(3),
  Scene.expect(Scene.role("cell", { name: "first note" })).toExist(),
  // Adding a note: the picture's label and the table follow the Model.
  Scene.type(Scene.label("Note"), "buy milk"),
  Scene.Command.resolve(DrawBars, drawn),
  Scene.click(Scene.role("button", { name: "Add" })),
  Scene.Command.resolveAll([SaveNote, NotesMessage.SucceededSaveNote({ requestId: KEY })], [MintRequestId, NotesMessage.MintedRequestId({ requestId: "next-key" })], [DrawBars, drawn], [DrawBars, drawn]),
  Scene.expectAll(Scene.all.role("row")).toHaveCount(4),
  Scene.expect(Scene.role("cell", { name: "Saved, waiting for the list" })).toExist(),
  Scene.expect(Scene.role("img", { name: LABEL.replace("2 bars", "3 bars") })).toExist()
)
console.log("ok  scene: loading, then ready; labelled controls; the table and the label follow an added note")

Scene.scene(
  { update, view },
  Scene.given(loading),
  // WebGL not available: the Mount reports it, the canvas leaves, the table stands in.
  Scene.Mount.resolve(HostScene, SceneMessage.FailedStartScene({ reason: "no WebGL 2 context" })),
  Scene.Mount.expectEnded(HostScene),
  Scene.Mount.expectNone(),
  Scene.expect(status).toHaveText("This browser can't draw the 3D chart. The same notes are in the table below."),
  Scene.expect(Scene.role("img")).toBeAbsent(),
  Scene.expectAll(Scene.all.role("row")).toHaveCount(3),
  Scene.expect(Scene.role("button", { name: "Turn right" })).toBeAbsent()
)
console.log("ok  scene: without WebGL the same notes show as a table and the canvas is gone")

Scene.scene(
  { update, view },
  Scene.given({ ...ready, scene: { ...ready.scene, status: SceneStatus.Lost() } }),
  // Context lost: the canvas stays (the browser restores into it) and the screen says what happened.
  Scene.expect(status).toHaveText("The chart stopped drawing. It restarts by itself. The table below has the same notes."),
  Scene.expect(Scene.role("img", { name: LABEL })).toExist(),
  Scene.expect(Scene.role("button", { name: "Turn right" })).toBeDisabled(),
  Scene.Mount.resolve(HostScene, SceneMessage.RestoredSceneContext()),
  Scene.Command.resolve(DrawBars, drawn),
  Scene.expect(status).toBeAbsent()
)
console.log("ok  scene: a lost context has its own screen and leaves it when restored")

const emptyScreens: ReadonlyArray<readonly [string, Model["notes"], string]> = [
  ["no notes yet", AsyncData.Success({ data: [] }), "Nothing to draw yet. Add the first note above."],
  ["notes loading", AsyncData.Loading(), "Loading notes…"],
  ["notes failed", AsyncData.Failure({ error: "Transport error" }), "Couldn't load notes, so there is nothing to draw. Retrying every few seconds."]
]
for (const [name, notes, text] of emptyScreens) {
  Scene.scene(
    { update, view },
    Scene.given({ ...ready, notes }),
    Scene.expect(status).toHaveText(text),
    Scene.expect(Scene.role("img", { name: "Chart of notes in the order they were written. No notes yet." })).toExist(),
    Scene.Mount.resolve(HostScene, SceneMessage.StartedScene()),
    start
  )
  console.log(`ok  scene: ${name} has its own screen`)
}

Scene.scene(
  { update, view },
  Scene.given({ ...ready, notes: AsyncData.Stale({ data: NOTES, error: "Transport error" }) }),
  // Stale: the last good notes stay drawn, and the screen says they are old.
  Scene.expect(Scene.text("Showing the last notes that loaded.")).toExist(),
  Scene.expect(Scene.role("img", { name: LABEL })).toExist(),
  Scene.expect(status).toBeAbsent(),
  Scene.Mount.resolve(HostScene, SceneMessage.StartedScene()),
  start
)
console.log("ok  scene: stale notes stay drawn and are marked as old")

Scene.scene(
  { update, view },
  Scene.given(ready),
  Scene.Mount.resolve(HostScene, SceneMessage.StartedScene()),
  start,
  // Hiding the chart removes the canvas, which is what ends the Mount and frees the GPU.
  Scene.click(Scene.role("button", { name: "Hide chart" })),
  Scene.Mount.expectEnded(HostScene),
  Scene.expect(Scene.role("img")).toBeAbsent(),
  Scene.click(Scene.role("button", { name: "Show chart" })),
  Scene.Mount.expectHas(HostScene),
  Scene.expect(status).toHaveText("Loading the chart…"),
  Scene.Mount.resolve(HostScene, SceneMessage.StartedScene()),
  start
)
console.log("ok  scene: hiding the chart ends the Mount; showing it starts a new one")
