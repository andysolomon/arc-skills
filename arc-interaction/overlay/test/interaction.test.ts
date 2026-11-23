/**
 * arc-interaction tests with no browser. Run: node test/interaction.test.ts
 *
 * What these prove: `update` turns a swipe or a click into one removal, the Mounts are in
 * the view, and a Mount's Message changes the Model. They can't prove that the row
 * moves. A Scene has no DOM, so a Mount's body never runs here. scripts/browser-check.mjs
 * proves that part in a real browser.
 */
import assert from "node:assert/strict"
import { Option } from "effect"
import { AsyncData, Scene, Story } from "foldkit"
import { FetchNotes, RemoveNote } from "../src/commands.ts"
import { DISMISS_DISTANCE_RATIO, DISMISS_VELOCITY, VELOCITY_WINDOW_MS } from "../src/interaction/constants.ts"
import { decideRelease, velocityOf } from "../src/interaction/swipe.ts"
import { emptyModel, update, view } from "../src/main.ts"
import { Message, type Model, RemovePhase } from "../src/model.ts"
import { DrawEmptyFigure, MoveRows, SwipeNote } from "../src/mounts.ts"

const A = { id: "a", text: "first note" }
const B = { id: "b", text: "second note" }
const two: Model = { ...emptyModel, notes: AsyncData.Success({ data: [A, B] }), draftRequestId: Option.some("k") }

/** Every row's swipe Mount, resolved with the Message that changes nothing. */
const rowsReady = (...ids: ReadonlyArray<string>) =>
  Scene.Mount.resolveAll(
    [MoveRows, Message.CompletedMoveRows()],
    ...ids.map((noteId) => [SwipeNote({ noteId }), Message.CompletedAttachSwipe()] as const)
  )

// PURE GESTURE LOGIC ---------------------------------------------------------

const WIDTH = 300
const far = WIDTH * DISMISS_DISTANCE_RATIO + 1
const fast = DISMISS_VELOCITY + 1
assert.equal(decideRelease(-far, 0, WIDTH), "dismiss-left", "far and still: dismissed")
assert.equal(decideRelease(far, 0, WIDTH), "dismiss-right")
assert.equal(decideRelease(-20, -fast, WIDTH), "dismiss-left", "near but flicked away: dismissed")
assert.equal(decideRelease(-20, 0, WIDTH), "return", "near and still: goes home")
assert.equal(decideRelease(-far, fast, WIDTH), "return", "far but flicked toward home: goes home")
assert.equal(decideRelease(0, fast, WIDTH), "return", "no offset: nothing to dismiss")
console.log("ok  swipe: distance or a flick dismisses; a flick home returns")

assert.equal(velocityOf([{ t: 0, x: 0 }, { t: 50, x: 50 }], 50), 1000, "50 px in 50 ms is 1000 px/s")
assert.equal(velocityOf([{ t: 0, x: 0 }, { t: 50, x: -25 }], 50), -500, "direction is the sign")
assert.equal(velocityOf([{ t: 0, x: 0 }, { t: 50, x: 50 }], 50 + VELOCITY_WINDOW_MS + 1), 0, "a pointer that stopped has no velocity")
assert.equal(velocityOf([], 0), 0)
console.log("ok  swipe: velocity is px per second over the last window, zero after a pause")

// UPDATE ---------------------------------------------------------------------

Story.story(
  update,
  Story.given(two),
  // The gesture ended. The Mount says only that; `update` decides it is a removal.
  Story.message(Message.SwipedAwayNote({ noteId: "a" })),
  Story.Command.expectExact(RemoveNote({ noteId: "a" })),
  Story.model((m) => assert.deepEqual(m.removing, [{ noteId: "a", phase: RemovePhase.Removing() }])),
  Story.Command.resolve(RemoveNote, Message.SucceededRemoveNote({ noteId: "a" })),
  Story.model((m) => assert.deepEqual(m.removing[0]!.phase, RemovePhase.Removed())),
  // A list load that still shows the note (it was in flight) keeps the row hidden.
  Story.message(Message.TickedRefresh()),
  Story.Command.resolve(FetchNotes, Message.SucceededFetchNotes({ notes: [A, B] })),
  Story.model((m) => assert.equal(m.removing.length, 1)),
  // The next one doesn't show it, so the removal is settled.
  Story.message(Message.TickedRefresh()),
  Story.Command.resolve(FetchNotes, Message.SucceededFetchNotes({ notes: [B] })),
  Story.model((m) => assert.equal(m.removing.length, 0))
)
console.log("ok  story: a swipe is one removal; it settles when a list load no longer shows the note")

Story.story(
  update,
  Story.given(two),
  Story.message(Message.ClickedRemove({ noteId: "a" })),
  Story.Command.expectExact(RemoveNote({ noteId: "a" })),
  Story.Command.resolve(RemoveNote, Message.FailedRemoveNote({ noteId: "a", error: "Transport error" })),
  Story.model((m) => assert.equal(m.removing[0]!.phase._tag, "Failed")),
  // Retry sends the SAME id.
  Story.message(Message.ClickedRetryRemove({ noteId: "a" })),
  Story.Command.expectExact(RemoveNote({ noteId: "a" })),
  Story.Command.resolve(RemoveNote, Message.FailedRemoveNote({ noteId: "a", error: "Transport error" })),
  // Keep gives up. The note is an ordinary row again and nothing is sent.
  Story.message(Message.ClickedKeep({ noteId: "a" })),
  Story.Command.expectNone(),
  Story.model((m) => assert.equal(m.removing.length, 0))
)
console.log("ok  story: the button removes too; a failed removal retries with the same id, or is kept")

// Story refuses a new Message while a Command is unresolved, so the double is tested by hand.
const once = update(two, Message.SwipedAwayNote({ noteId: "a" }))
assert.deepEqual(once.commands?.map((c) => c.name), ["RemoveNote"])
assert.equal(update(once.model, Message.ClickedRemove({ noteId: "a" })).commands, undefined)
assert.equal(update(once.model, Message.SwipedAwayNote({ noteId: "a" })).commands, undefined)
assert.equal(update(two, Message.SwipedAwayNote({ noteId: "nope" })).commands, undefined)
console.log("ok  update: a swipe and a click on the same row send one request; an unknown note sends none")

// A lost reply. The removal failed on the client, but the server removed the note.
Story.story(
  update,
  Story.given({ ...two, removing: [{ noteId: "a", phase: RemovePhase.Failed({ error: "Transport error" }) }] }),
  Story.message(Message.TickedRefresh()),
  Story.Command.resolve(FetchNotes, Message.SucceededFetchNotes({ notes: [B] })),
  Story.model((m) => assert.equal(m.removing.length, 0))
)
console.log("ok  story: a failed removal the server did carry out is cleared by the next load")

// VIEW -----------------------------------------------------------------------

Scene.scene(
  { update, view },
  Scene.given(two),
  // The Mounts are in the view: one on the list, one on each row.
  Scene.Mount.expectExact(MoveRows, SwipeNote({ noteId: "a" }), SwipeNote({ noteId: "b" })),
  // The gesture's result Message, as the Mount would send it after the row has left.
  Scene.Mount.resolveAll(
    [MoveRows, Message.CompletedMoveRows()],
    [SwipeNote({ noteId: "b" }), Message.CompletedAttachSwipe()],
    [SwipeNote({ noteId: "a" }), Message.SwipedAwayNote({ noteId: "a" })]
  ),
  // It changed the Model. The row is gone and its Mount ended.
  Scene.Mount.expectEnded(SwipeNote),
  Scene.Command.expectExact(RemoveNote({ noteId: "a" })),
  Scene.expect(Scene.text("first note")).toBeAbsent(),
  Scene.expect(Scene.text("second note")).toExist(),
  Scene.Command.resolve(RemoveNote, Message.SucceededRemoveNote({ noteId: "a" }))
)
console.log("ok  scene: the swipe Mount is on each row, and its Message removes the row")

Scene.scene(
  { update, view },
  Scene.given(two),
  rowsReady("a", "b"),
  // The same thing with no gesture, through a labelled button.
  Scene.click(Scene.role("button", { name: "Remove first note" })),
  Scene.Mount.expectEnded(SwipeNote),
  Scene.expect(Scene.text("first note")).toBeAbsent(),
  // The removal fails. The row comes back, says so, and offers both ways out.
  Scene.Command.resolve(RemoveNote, Message.FailedRemoveNote({ noteId: "a", error: "Transport error" })),
  Scene.expect(Scene.text("not removed")).toExist(),
  Scene.expect(Scene.text("Couldn't remove this note. Check your connection and retry.")).toExist(),
  Scene.expect(Scene.role("button", { name: "Keep first note" })).toExist(),
  Scene.click(Scene.role("button", { name: "Retry removing first note" })),
  Scene.Command.resolve(RemoveNote, Message.SucceededRemoveNote({ noteId: "a" })),
  Scene.expect(Scene.text("first note")).toBeAbsent()
)
console.log("ok  scene: the Remove button does what the swipe does; a failed removal shows Retry and Keep")

Scene.scene(
  { update, view },
  Scene.given({ ...two, notes: AsyncData.Success({ data: [A] }) }),
  rowsReady("a"),
  Scene.click(Scene.role("button", { name: "Remove first note" })),
  Scene.Mount.expectEnded(SwipeNote),
  // The last row is gone. The empty state shows its figure, by role and label, and still says what to do.
  Scene.Mount.expectHas(DrawEmptyFigure({ label: "An empty drawer" })),
  Scene.Mount.resolve(DrawEmptyFigure, Message.CompletedDrawEmptyFigure()),
  Scene.expect(Scene.role("img", { name: "An empty drawer" })).toExist(),
  Scene.expect(Scene.text("No notes yet. Add the first one above.")).toExist(),
  Scene.Command.resolve(RemoveNote, Message.SucceededRemoveNote({ noteId: "a" }))
)
console.log("ok  scene: removing the last note shows the labelled empty-state figure")
