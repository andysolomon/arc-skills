/**
 * Tests with no browser and no server. Run: node test/app.test.ts
 *
 * Story drives `update` and checks the Commands it asks for. Scene drives `view` by role
 * and label, so an unlabelled control fails here. Both insist that every Command is
 * resolved before the next Message.
 */
import assert from "node:assert/strict"
import { Option } from "effect"
import { AsyncData, Scene, Story } from "foldkit"
import { FetchNotes, MintRequestId, SaveNote } from "../src/commands.ts"
import { emptyModel, init, update, view } from "../src/main.ts"
import { Message, type Model, Phase } from "../src/model.ts"

const KEY = "11111111-aaaa-4bbb-8ccc-000000000001"
const loaded: Model = { ...emptyModel, notes: AsyncData.Success({ data: [{ id: "n1", text: "first note" }] }), draftRequestId: Option.some(KEY) }

// Story does not run `init`, so check its Commands directly.
assert.deepEqual(init().commands?.map((c) => c.name), ["MintRequestId", "FetchNotes"])

Story.story(
  update,
  Story.given(loaded),
  Story.message(Message.ChangedDraft({ text: "buy milk" })),
  Story.message(Message.SubmittedNote()),
  // The key was minted BEFORE the submit, and a fresh one is requested for the next draft.
  Story.Command.expectExact(SaveNote({ requestId: KEY, text: "buy milk" }), MintRequestId),
  Story.model((m) => {
    assert.equal(m.draft, "")
    assert.ok(Option.isNone(m.draftRequestId))
    assert.deepEqual(m.pending[0]!.phase, Phase.Saving())
  }),
  Story.Command.resolve(MintRequestId, Message.MintedRequestId({ requestId: "next-key" })),
  Story.Command.resolve(SaveNote, Message.FailedSaveNote({ requestId: KEY, error: "Transport error" })),
  Story.model((m) => assert.equal(m.pending[0]!.phase._tag, "Failed")),
  // Retry re-sends the SAME key.
  Story.message(Message.ClickedRetry({ requestId: KEY })),
  Story.Command.expectExact(SaveNote({ requestId: KEY, text: "buy milk" })),
  Story.Command.resolve(SaveNote, Message.SucceededSaveNote({ requestId: KEY })),
  Story.model((m) => assert.deepEqual(m.pending[0]!.phase, Phase.Saved())),
  // The saved note leaves `pending` once a list load shows it.
  Story.message(Message.TickedRefresh()),
  Story.Command.expectExact(FetchNotes),
  Story.Command.resolve(FetchNotes, Message.SucceededFetchNotes({ notes: [{ id: KEY, text: "buy milk" }, { id: "n1", text: "first note" }] })),
  Story.model((m) => assert.equal(m.pending.length, 0))
)
console.log("ok  story: key minted before send, retry reuses it, a list load clears the saved row")

// Story refuses a new Message while a Command is unresolved, so "two requests in flight"
// is tested by calling `update` directly.
const first = update(loaded, Message.TickedRefresh())
assert.deepEqual(first.commands?.map((c) => c.name), ["FetchNotes"])
const second = update(first.model, Message.TickedRefresh())
assert.equal(second.commands, undefined)
console.log("ok  update: a tick while a load is in flight does not stack a second request")

Story.story(
  update,
  Story.given({ ...loaded, draft: "buy milk", draftRequestId: Option.none() }),
  // No key yet (or a double-submit already took it): nothing is sent.
  Story.message(Message.SubmittedNote()),
  Story.Command.expectNone()
)
console.log("ok  story: a submit without a key sends nothing")

Scene.scene(
  { update, view },
  Scene.given(loaded),
  Scene.expect(Scene.role("status")).toHaveText("Up to date"),
  Scene.expect(Scene.role("button", { name: "Add" })).toBeDisabled(),
  Scene.type(Scene.label("Note"), "buy milk"),
  Scene.click(Scene.role("button", { name: "Add" })),
  Scene.expect(Scene.text("saving")).toExist(),
  Scene.Command.resolveAll(
    [SaveNote, Message.SucceededSaveNote({ requestId: KEY })],
    [MintRequestId, Message.MintedRequestId({ requestId: "next-key" })]
  ),
  Scene.expect(Scene.text("saved")).toExist(),
  // The next list load fails: the last good list stays on screen.
  Scene.Subscription.emit(Message.TickedRefresh()),
  Scene.Command.resolve(FetchNotes, Message.FailedFetchNotes({ error: "Transport error" })),
  Scene.expect(Scene.role("status")).toHaveText("Reconnecting…"),
  Scene.expect(Scene.text("first note")).toExist()
)
console.log("ok  scene: type, add, saving, saved; a failed reload keeps the list")

Scene.scene(
  { update, view },
  Scene.given({ ...emptyModel, notes: AsyncData.Success({ data: [] }) }),
  Scene.expect(Scene.text("No notes yet. Add the first one above.")).toExist()
)
console.log("ok  scene: the empty state says how to add a note")
