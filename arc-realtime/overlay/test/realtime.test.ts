/**
 * arc-realtime tests, with no browser and no server. Run: node test/realtime.test.ts
 *
 * Story covers every connection state and a reconnect. Scene covers each state's screen.
 * The socket stream and the send path run against stub services. The two-person check
 * needs a real browser: test/two-people.browser.mjs.
 */
import assert from "node:assert/strict"
import { Effect, Layer, Option, Stream } from "effect"
import { AsyncData, Scene, Story } from "foldkit"
import { FetchNotes } from "../src/commands.ts"
import { emptyModel, otherPeer, refreshDue, update, view } from "../src/main.ts"
import { Connection, Direct, Message, type Model, Phase } from "../src/model.ts"
import { AcceptAnswer, AnswerDirect, OfferDirect, PeerLink, type PeerEvent, peerMessages, SendWave } from "../src/peer.ts"
import { backoffMs, frameToMessage, MAX_RETRIES, RoomSocket, type SocketEvent, socketMessages, SocketNotOpen, WaitBackoff } from "../src/realtime.ts"

const n1 = { id: "n1", text: "first note" }
const n2 = { id: "n2", text: "second note" }
const connecting: Model = { ...emptyModel, notes: AsyncData.Success({ data: [n1] }) }
const live: Model = { ...connecting, connection: Connection.Live(), self: Option.some("me"), peers: ["me", "you"] }

// FRAMES ---------------------------------------------------------------------

assert.deepEqual(frameToMessage(`{"type":"welcome","peer":"me","peers":["me"]}`), Message.ReceivedWelcome({ peer: "me", peers: ["me"] }))
assert.deepEqual(frameToMessage(`{"type":"presence","peers":["me","you"]}`), Message.ChangedPresence({ peers: ["me", "you"] }))
assert.deepEqual(frameToMessage(`{"type":"note","note":{"id":"n2","text":"second note"}}`), Message.ReceivedNote({ note: n2 }))
assert.deepEqual(frameToMessage(`{"type":"signal","from":"you","kind":"offer","sdp":"v=0"}`), Message.ReceivedOffer({ from: "you", sdp: "v=0" }))
assert.deepEqual(frameToMessage(`{"type":"signal","from":"you","kind":"answer","sdp":"v=0"}`), Message.ReceivedAnswer({ from: "you", sdp: "v=0" }))
assert.deepEqual(frameToMessage(`{"type":"rejected","reason":"that peer is not here"}`), Message.RejectedFrame({ reason: "that peer is not here" }))
for (const bad of ["not json", `{"type":"note","note":{"id":1}}`, `{"type":"surprise"}`, `{"type":"signal","from":"you","kind":"shout","sdp":"v=0"}`, new Uint8Array([1, 2, 3]), null]) {
  assert.equal(frameToMessage(bad)._tag, "FailedDecodeFrame")
}
assert.deepEqual(update(live, Message.FailedDecodeFrame({ error: "x" })), { model: live })
console.log("ok  frames: each frame type decodes to its Message; bad JSON, a wrong shape and a binary frame become FailedDecodeFrame")

// STORY: every connection state and a reconnect ------------------------------

Story.story(
  update,
  Story.given(connecting),
  // Connecting -> Live, and the catch-up load starts.
  Story.message(Message.ReceivedWelcome({ peer: "me", peers: ["me", "you"] })),
  Story.Command.expectExact(FetchNotes),
  Story.Command.resolve(FetchNotes, Message.SucceededFetchNotes({ notes: [n1] })),
  Story.model((m) => {
    assert.deepEqual(m.connection, Connection.Live())
    assert.deepEqual(m.self, Option.some("me"))
    assert.equal(m.peers.length, 2)
  }),
  // A note from someone else arrives over the socket.
  Story.message(Message.ReceivedNote({ note: n2 })),
  Story.model((m) => assert.deepEqual(m.arrived, [n2])),
  // The same note again changes nothing.
  Story.message(Message.ReceivedNote({ note: n2 })),
  Story.model((m) => assert.deepEqual(m.arrived, [n2])),
  Story.message(Message.ChangedPresence({ peers: ["me"] })),
  Story.model((m) => assert.deepEqual(m.peers, ["me"])),
  // Live -> Reconnecting: the first retry waits one second, and presence is unknown again.
  Story.message(Message.ClosedSocket({ code: 1006 })),
  Story.Command.expectExact(WaitBackoff({ attempt: 1, delayMs: 1000 })),
  Story.model((m) => {
    assert.deepEqual(m.connection, Connection.Reconnecting({ attempt: 1 }))
    assert.deepEqual(m.peers, [])
    assert.ok(Option.isNone(m.self))
    assert.deepEqual(m.arrived, [n2]) // the last good data stays
  }),
  // Reconnecting -> Connecting: the time arrived as a Message.
  Story.Command.resolve(WaitBackoff, Message.ElapsedBackoff({ attempt: 1 })),
  Story.model((m) => assert.deepEqual(m.connection, Connection.Connecting({ attempt: 1 }))),
  // Connecting -> Live again, and the reconnect catches up on what it missed.
  Story.message(Message.ReceivedWelcome({ peer: "me-again", peers: ["me-again"] })),
  Story.Command.expectExact(FetchNotes),
  Story.Command.resolve(FetchNotes, Message.SucceededFetchNotes({ notes: [{ id: "n3", text: "missed while away" }, n2, n1] })),
  Story.model((m) => {
    assert.deepEqual(m.connection, Connection.Live())
    assert.deepEqual(AsyncData.getData(m.notes), Option.some([{ id: "n3", text: "missed while away" }, n2, n1]))
    assert.deepEqual(m.arrived, []) // the list shows n2 now
  })
)
console.log("ok  story: connecting, live, a note arrives, reconnecting with a 1 s backoff, live again with a catch-up load")

// Each failed try waits longer, then the app goes offline. Reconnect starts over.
{
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(backoffMs), [1000, 2000, 4000, 8000, 16000, 30000, 30000])
  let model = live
  const waits: Array<unknown> = []
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const closed = update(model, Message.ClosedSocket({ code: 1006 }))
    assert.deepEqual(closed.model.connection, Connection.Reconnecting({ attempt }))
    waits.push(closed.commands?.map((c) => [c.name, c.args]))
    // A backoff for another attempt is ignored: only the one the Model waits on may dial.
    assert.deepEqual(update(closed.model, Message.ElapsedBackoff({ attempt: attempt + 1 })), { model: closed.model })
    model = update(closed.model, Message.ElapsedBackoff({ attempt })).model
    assert.deepEqual(model.connection, Connection.Connecting({ attempt }))
  }
  assert.deepEqual(waits, [1000, 2000, 4000, 8000, 16000].map((delayMs, i) => [["WaitBackoff", { attempt: i + 1, delayMs }]]))
  const offline = update(model, Message.ClosedSocket({ code: 1006 }))
  assert.deepEqual(offline.model.connection, Connection.Offline())
  assert.equal(offline.commands, undefined)
  // Offline ignores a late close and a late backoff.
  assert.deepEqual(update(offline.model, Message.ClosedSocket({ code: 1006 })), { model: offline.model })
  assert.deepEqual(update(offline.model, Message.ElapsedBackoff({ attempt: 5 })), { model: offline.model })
  assert.deepEqual(update(offline.model, Message.ClickedReconnect()).model.connection, Connection.Connecting({ attempt: 0 }))
}
console.log("ok  update: five retries wait 1, 2, 4, 8 and 16 s, then Offline; Reconnect starts at attempt 0")

// The poll rests while live, runs as the fallback, and runs once to confirm a saved row.
{
  assert.equal(update(live, Message.TickedRefresh()).commands, undefined)
  assert.deepEqual(update(connecting, Message.TickedRefresh()).commands?.map((c) => c.name), ["FetchNotes"])
  const saved: Model = { ...live, pending: [{ requestId: "k1", text: "mine", phase: Phase.Saved() }] }
  assert.ok(refreshDue(saved))
  assert.deepEqual(update(saved, Message.TickedRefresh()).commands?.map((c) => c.name), ["FetchNotes"])
}
console.log("ok  update: a tick loads nothing while live, loads when not live, and loads to confirm a saved row")

// A welcome while a list load is in flight: that load may be older than the socket, so one
// more is owed, and it starts when the first one ends. Two requests in flight, so no Story.
{
  const loading: Model = { ...emptyModel }
  const welcomed = update(loading, Message.ReceivedWelcome({ peer: "me", peers: ["me"] }))
  assert.equal(welcomed.commands, undefined)
  assert.equal(welcomed.model.catchUpOwed, true)
  const first = update(welcomed.model, Message.SucceededFetchNotes({ notes: [n1] }))
  assert.deepEqual(first.commands?.map((c) => c.name), ["FetchNotes"])
  assert.equal(first.model.catchUpOwed, false)
  assert.equal(update(first.model, Message.SucceededFetchNotes({ notes: [n1] })).commands, undefined)
}
console.log("ok  update: a welcome during a list load owes one more load, sent when the first ends")

// A note frame for a row of our own: it settles a failed row (a lost reply the server kept),
// and it leaves a row that is still saving to its own reply. A list load that was read
// before a note was stored does not remove that note.
{
  const failed: Model = { ...live, pending: [{ requestId: "k1", text: "mine", phase: Phase.Failed({ error: "Transport error" }) }] }
  assert.equal(update(failed, Message.ReceivedNote({ note: { id: "k1", text: "mine" } })).model.pending.length, 0)
  const saving: Model = { ...live, pending: [{ requestId: "k1", text: "mine", phase: Phase.Saving() }] }
  assert.equal(update(saving, Message.ReceivedNote({ note: { id: "k1", text: "mine" } })).model.pending.length, 1)
  const arrived: Model = { ...live, arrived: [n2] }
  assert.deepEqual(update(arrived, Message.SucceededFetchNotes({ notes: [n1] })).model.arrived, [n2])
}
console.log("ok  update: a note frame settles a failed row, not a saving one; an older list load keeps a newer note")

// STORY: the direct link -----------------------------------------------------

Story.story(
  update,
  Story.given(live),
  Story.message(Message.ClickedConnectDirect()),
  Story.Command.expectExact(OfferDirect({ to: "you" })),
  Story.Command.resolve(OfferDirect, Message.SentSignal({ to: "you" })),
  Story.model((m) => assert.deepEqual(m.direct, Direct.Opening({ peer: "you" }))),
  // An answer from someone else is ignored.
  Story.message(Message.ReceivedAnswer({ from: "stranger", sdp: "v=0" })),
  Story.Command.expectNone(),
  Story.message(Message.ReceivedAnswer({ from: "you", sdp: "v=0 answer" })),
  Story.Command.expectExact(AcceptAnswer({ sdp: "v=0 answer" })),
  Story.Command.resolve(AcceptAnswer, Message.AppliedAnswer()),
  Story.message(Message.OpenedDirect()),
  Story.model((m) => assert.deepEqual(m.direct, Direct.Open({ peer: "you" }))),
  Story.message(Message.ClickedWave()),
  Story.Command.resolve(SendWave, Message.SentWave()),
  Story.message(Message.ReceivedWave()),
  Story.model((m) => assert.deepEqual([m.wavesSent, m.wavesReceived], [1, 1])),
  // The room socket drops: the open link has its own connection, so it stays.
  Story.message(Message.ClosedSocket({ code: 1006 })),
  Story.Command.resolve(WaitBackoff, Message.ElapsedBackoff({ attempt: 1 })),
  Story.model((m) => assert.deepEqual(m.direct, Direct.Open({ peer: "you" }))),
  Story.message(Message.ClosedDirect()),
  Story.model((m) => assert.deepEqual(m.direct, Direct.Idle()))
)
console.log("ok  story: offer, answer, open, a wave each way; the open link outlives a socket drop")

{
  // The other side: an offer arrives, this side answers.
  const answered = update(live, Message.ReceivedOffer({ from: "you", sdp: "v=0 offer" }))
  assert.deepEqual(answered.commands?.map((c) => [c.name, c.args]), [["AnswerDirect", { from: "you", sdp: "v=0 offer" }]])
  // Both pressed at once: "me" sorts before "you", so "me" gives way and "you" ignores the offer.
  const opening: Model = { ...live, direct: Direct.Opening({ peer: "you" }) }
  assert.deepEqual(update(opening, Message.ReceivedOffer({ from: "you", sdp: "v=0" })).commands?.map((c) => c.name), ["AnswerDirect"])
  const other: Model = { ...live, self: Option.some("you"), peers: ["me", "you"], direct: Direct.Opening({ peer: "me" }) }
  assert.equal(update(other, Message.ReceivedOffer({ from: "me", sdp: "v=0" })).commands, undefined)
  // A handshake cannot finish once the peer leaves, the server refuses the signal, or the socket drops.
  assert.equal(update(opening, Message.ChangedPresence({ peers: ["me"] })).model.direct._tag, "Failed")
  assert.equal(update(opening, Message.RejectedFrame({ reason: "that peer is not here" })).model.direct._tag, "Failed")
  assert.equal(update(opening, Message.ClosedSocket({ code: 1006 })).model.direct._tag, "Failed")
  // Alone, or not live, the button's Message does nothing.
  assert.ok(Option.isNone(otherPeer({ ...live, peers: ["me"] })))
  assert.equal(update({ ...live, peers: ["me"] }, Message.ClickedConnectDirect()).commands, undefined)
  assert.equal(update({ ...live, connection: Connection.Offline() }, Message.ClickedConnectDirect()).commands, undefined)
}
console.log("ok  update: an offer is answered, a tie gives way by peer id, and a broken handshake fails with a reason")

// SCENE: each state's screen -------------------------------------------------

Scene.scene(
  { update, view },
  Scene.given(connecting),
  Scene.expect(Scene.role("status")).toHaveText("Connecting…"),
  Scene.expect(Scene.text("first note")).toExist(),
  Scene.expect(Scene.text("A direct link needs a second person here and a live connection.")).toExist(),
  // Live, with two people.
  Scene.Subscription.emit(Message.ReceivedWelcome({ peer: "me", peers: ["me", "you"] })),
  Scene.Command.resolve(FetchNotes, Message.SucceededFetchNotes({ notes: [n1] })),
  Scene.expect(Scene.role("status")).toHaveText("Live"),
  Scene.expect(Scene.text("2 people are here.")).toExist(),
  Scene.expect(Scene.role("button", { name: "Connect directly" })).toExist(),
  Scene.Subscription.emit(Message.ReceivedNote({ note: n2 })),
  Scene.expect(Scene.text("second note")).toExist(),
  Scene.Subscription.emit(Message.ChangedPresence({ peers: ["me"] })),
  Scene.expect(Scene.text("Only you are here.")).toExist(),
  // Reconnecting: the notes stay on screen.
  Scene.Subscription.emit(Message.ClosedSocket({ code: 1006 })),
  Scene.expect(Scene.role("status")).toHaveText("Reconnecting…"),
  Scene.expect(Scene.text("The live connection dropped. Trying again.")).toExist(),
  Scene.expect(Scene.text("first note")).toExist(),
  Scene.expect(Scene.text("second note")).toExist(),
  Scene.expect(Scene.text("Only you are here.")).toBeAbsent(),
  // The retry is dialling: still Reconnecting to the person looking at it.
  Scene.Command.resolve(WaitBackoff, Message.ElapsedBackoff({ attempt: 1 })),
  Scene.expect(Scene.role("status")).toHaveText("Reconnecting…")
)
console.log("ok  scene: connecting, live with presence, a note from the socket, reconnecting with the notes still shown")

Scene.scene(
  { update, view },
  Scene.given({ ...connecting, connection: Connection.Offline() }),
  Scene.expect(Scene.role("status")).toHaveText("Offline"),
  Scene.expect(Scene.text(`Live updates stopped after ${MAX_RETRIES} tries. The list still refreshes every few seconds, and notes you add are still sent.`)).toExist(),
  Scene.expect(Scene.text("first note")).toExist(),
  Scene.click(Scene.role("button", { name: "Reconnect" })),
  Scene.expect(Scene.role("status")).toHaveText("Connecting…"),
  Scene.expect(Scene.role("button", { name: "Reconnect" })).toBeAbsent()
)
console.log("ok  scene: offline says what still works, and Reconnect dials again")

Scene.scene(
  { update, view },
  Scene.given(live),
  Scene.click(Scene.role("button", { name: "Connect directly" })),
  Scene.expect(Scene.text("Opening a direct link…")).toExist(),
  Scene.Command.resolve(OfferDirect, Message.FailedDirect({ error: "ICE gathering timed out" })),
  Scene.expect(Scene.text("The direct link didn't open. Notes still sync through the server.")).toExist(),
  Scene.click(Scene.role("button", { name: "Try again" })),
  Scene.Command.resolve(OfferDirect, Message.SentSignal({ to: "you" })),
  Scene.Subscription.emit(Message.ReceivedAnswer({ from: "you", sdp: "v=0" })),
  Scene.Command.resolve(AcceptAnswer, Message.AppliedAnswer()),
  Scene.Subscription.emit(Message.OpenedDirect()),
  Scene.expect(Scene.text("Direct link open.")).toExist(),
  Scene.click(Scene.role("button", { name: "Wave" })),
  Scene.Command.resolve(SendWave, Message.SentWave()),
  Scene.expect(Scene.text("Waves sent 1, received 0.")).toExist()
)
console.log("ok  scene: the direct link shows opening, failed with a way to retry, and open with a wave count")

// The stale screen: the list could not refresh, and the last good one stays.
Scene.scene(
  { update, view },
  Scene.given({ ...connecting, connection: Connection.Reconnecting({ attempt: 2 }), notes: AsyncData.Stale({ data: [n1], error: "Transport error" }) }),
  Scene.expect(Scene.role("status")).toHaveText("Reconnecting…"),
  Scene.expect(Scene.text("Couldn't refresh the list. These are the last notes received.")).toExist(),
  Scene.expect(Scene.text("first note")).toExist()
)
console.log("ok  scene: stale keeps the last notes and says the list could not refresh")

// THE SOCKET STREAM, against a stub service ----------------------------------

/** A RoomSocket that plays `events` and records what is sent. `open: false` makes every send fail. */
const stubSocket = (events: ReadonlyArray<SocketEvent>, open = true) => {
  const sent: Array<string> = []
  const layer = Layer.succeed(
    RoomSocket,
    RoomSocket.of({
      events: Stream.fromIterable(events),
      send: (text) => (open ? Effect.sync(() => void sent.push(text)) : Effect.fail(new SocketNotOpen()))
    })
  )
  return { sent, layer }
}

{
  const { layer } = stubSocket([
    { _tag: "Frame", data: `{"type":"welcome","peer":"me","peers":["me"]}` },
    { _tag: "Frame", data: "garbage" },
    { _tag: "Frame", data: `{"type":"note","note":{"id":"n2","text":"second note"}}` },
    { _tag: "Closed", code: 1006 }
  ])
  const messages = await Effect.runPromise(Stream.runCollect(socketMessages).pipe(Effect.provide(layer)))
  assert.deepEqual(messages.map((m) => m._tag), ["ReceivedWelcome", "FailedDecodeFrame", "ReceivedNote", "ClosedSocket"])
}
console.log("ok  subscription: the socket stream turns frames into Messages, survives a bad frame, and ends with ClosedSocket")

// COMMANDS, against stub services --------------------------------------------

/** A PeerLink that hands back fixed descriptions and records what it is asked to do. */
const stubPeer = (events: ReadonlyArray<PeerEvent> = []) => {
  const calls: Array<string> = []
  const layer = Layer.succeed(
    PeerLink,
    PeerLink.of({
      events: Stream.fromIterable(events),
      offer: Effect.sync(() => (calls.push("offer"), "v=0 offer")),
      answer: (sdp) => Effect.sync(() => (calls.push(`answer to ${sdp}`), "v=0 answer")),
      accept: (sdp) => Effect.sync(() => void calls.push(`accept ${sdp}`)),
      send: (text) => Effect.sync(() => void calls.push(`send ${text}`))
    })
  )
  return { calls, layer }
}

{
  // The send path: the offer goes out as one signal frame, addressed to the peer.
  const socket = stubSocket([])
  const peer = stubPeer()
  const sentOffer = await Effect.runPromise(OfferDirect({ to: "you" }).effect.pipe(Effect.provide(Layer.merge(socket.layer, peer.layer))))
  assert.deepEqual(sentOffer, Message.SentSignal({ to: "you" }))
  assert.deepEqual(socket.sent.map((text) => JSON.parse(text)), [{ type: "signal", to: "you", kind: "offer", sdp: "v=0 offer" }])

  const sentAnswer = await Effect.runPromise(AnswerDirect({ from: "you", sdp: "v=0 offer" }).effect.pipe(Effect.provide(Layer.merge(socket.layer, peer.layer))))
  assert.deepEqual(sentAnswer, Message.SentSignal({ to: "you" }))
  assert.deepEqual(JSON.parse(socket.sent[1]!), { type: "signal", to: "you", kind: "answer", sdp: "v=0 answer" })
  assert.deepEqual(peer.calls, ["offer", "answer to v=0 offer"])

  // A socket that is not open: the failure is a Message, and nothing is sent.
  const closed = stubSocket([], false)
  const failed = await Effect.runPromise(OfferDirect({ to: "you" }).effect.pipe(Effect.provide(Layer.merge(closed.layer, peer.layer))))
  assert.deepEqual(failed, Message.FailedDirect({ error: "the room socket is not open" }))
  assert.equal(closed.sent.length, 0)

  assert.deepEqual(await Effect.runPromise(AcceptAnswer({ sdp: "v=0 answer" }).effect.pipe(Effect.provide(peer.layer))), Message.AppliedAnswer())
  assert.deepEqual(await Effect.runPromise(SendWave().effect.pipe(Effect.provide(peer.layer))), Message.SentWave())
  assert.deepEqual(peer.calls.slice(-2), ["accept v=0 answer", "send wave"])
}
console.log("ok  command: a signal goes out as one frame; a closed socket fails as a Message")

{
  const peer = stubPeer([{ _tag: "Opened" }, { _tag: "Received", data: "wave" }, { _tag: "Received", data: "something else" }, { _tag: "Closed" }])
  const messages = await Effect.runPromise(Stream.runCollect(peerMessages).pipe(Effect.provide(peer.layer)))
  assert.deepEqual(messages.map((m) => m._tag), ["OpenedDirect", "ReceivedWave", "FailedDecodeFrame", "ClosedDirect"])
}
console.log("ok  subscription: the peer stream decodes the channel's messages too")

assert.deepEqual(await Effect.runPromise(WaitBackoff({ attempt: 2, delayMs: 2 }).effect), Message.ElapsedBackoff({ attempt: 2 }))
console.log("ok  command: the backoff wait answers with the attempt it was started for")
