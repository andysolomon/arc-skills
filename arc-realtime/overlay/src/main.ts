/**
 * A Foldkit program: The Elm Architecture on Effect. Definitions only; nothing runs here.
 *
 *   model.ts     Model + Messages (Schemas)
 *   commands.ts  side effects as values
 *   main.ts      update + init + subscriptions + view   <- this file
 *   entry.ts     boots the browser Runtime (the only file that touches `document`)
 */
import { Duration, Option, Result, Schema, Stream } from "effect"
import type { HttpClient } from "effect/http"
import { AsyncData, Subscription, type Update } from "foldkit"
import type { Document, Html, HtmlBuilder } from "foldkit/html"
import { modifyFields } from "foldkit/struct"
import { FetchNotes, MintRequestId, SaveNote } from "./commands.ts"
import { Connection, Direct, Message, type Model, type Note, type Pending, Phase } from "./model.ts"
// arc-realtime
import { AcceptAnswer, AnswerDirect, OfferDirect, PeerLink, peerMessages, SendWave } from "./peer.ts"
import { backoffMs, MAX_RETRIES, RoomSocket, socketMessages, WaitBackoff } from "./realtime.ts"

export { Model } from "./model.ts"

type Return = Update.Return<Model, Message, HttpClient.HttpClient | RoomSocket | PeerLink>

export const REFRESH_EVERY = Duration.seconds(5)

// UPDATE ---------------------------------------------------------------------
// Pure. The only place state changes. No clocks, no randomness, no fetch.

const setPending = (model: Model, requestId: string, f: (p: Pending) => Pending): Model =>
  modifyFields(model, { pending: (ps) => ps.map((p) => (p.requestId === requestId ? f(p) : p)) })

/** Start a list load unless one is already in flight. */
const refresh = (model: Model): Return =>
  Option.match(AsyncData.revalidateOrLoad(model.notes), {
    onNone: () => ({ model }),
    onSome: (notes) => ({ model: modifyFields(model, { notes: () => notes }), commands: [FetchNotes()] })
  })

// arc-realtime ---------------------------------------------------------------

/**
 * Is a list load due on this tick? While the socket is live it delivers every new note, so
 * the poll rests. It runs when the socket is not live (the fallback), and once after a
 * save, to confirm the "saved" row.
 */
export const refreshDue = (model: Model): boolean => model.connection._tag !== "Live" || model.pending.some((p) => p.phase._tag === "Saved")

/** Is this note already on screen, from the socket or from a list load? */
const known = (model: Model, id: string): boolean =>
  model.arrived.some((n) => n.id === id) || Option.getOrElse(AsyncData.getData(model.notes), (): ReadonlyArray<Note> => []).some((n) => n.id === id)

/** After any list load ends, start the one the welcome frame is still owed. */
const settled = (model: Model): Return => (model.catchUpOwed ? refresh(modifyFields(model, { catchUpOwed: () => false })) : { model })

/** The socket closed: count the failure, then wait out the backoff or give up. */
const dropped = (model: Model): Return => {
  if (model.connection._tag !== "Connecting" && model.connection._tag !== "Live") return { model }
  const attempt = model.connection._tag === "Live" ? 1 : model.connection.attempt + 1
  // Presence is unknown without a socket. An open direct link has its own connection and
  // stays; a handshake that was still travelling over the socket cannot finish.
  const cleared = modifyFields(model, {
    self: () => Option.none(),
    peers: () => [],
    catchUpOwed: () => false,
    direct: (d) => (d._tag === "Opening" ? Direct.Failed({ error: "the room socket closed during the handshake" }) : d)
  })
  if (attempt > MAX_RETRIES) return { model: modifyFields(cleared, { connection: () => Connection.Offline() }) }
  return {
    model: modifyFields(cleared, { connection: () => Connection.Reconnecting({ attempt }) }),
    commands: [WaitBackoff({ attempt, delayMs: backoffMs(attempt) })]
  }
}

/** Someone else in the room, to open a direct link with. */
export const otherPeer = (model: Model): Option.Option<string> =>
  Option.fromNullishOr(model.peers.find((peer) => Option.isNone(model.self) || peer !== model.self.value))

const startDirect = (model: Model): Return => {
  const peer = otherPeer(model)
  if (model.connection._tag !== "Live" || Option.isNone(peer) || (model.direct._tag !== "Idle" && model.direct._tag !== "Failed")) return { model }
  return { model: modifyFields(model, { direct: () => Direct.Opening({ peer: peer.value }) }), commands: [OfferDirect({ to: peer.value })] }
}

// ------------------------------------------------------------- arc-realtime

export const update = (model: Model, message: Message): Return =>
  Message.match<Return>(message, {
    ChangedDraft: ({ text }) => ({ model: modifyFields(model, { draft: () => text }) }),

    SubmittedNote: () => {
      const text = model.draft.trim()
      if (text === "" || Option.isNone(model.draftRequestId)) return { model } // a double-submit lands here
      const requestId = model.draftRequestId.value
      const pending: Pending = { requestId, text, phase: Phase.Saving() }
      return {
        model: modifyFields(model, { pending: (ps) => [pending, ...ps], draft: () => "", draftRequestId: () => Option.none() }),
        commands: [SaveNote({ requestId, text }), MintRequestId()] // and a fresh key for the NEXT draft
      }
    },

    ClickedRetry: ({ requestId }) => {
      const pending = model.pending.find((p) => p.requestId === requestId)
      if (pending === undefined || pending.phase._tag !== "Failed") return { model }
      // Same requestId as the first attempt: if that attempt landed, the server keeps one note.
      return {
        model: setPending(model, requestId, (p) => ({ ...p, phase: Phase.Saving() })),
        commands: [SaveNote({ requestId, text: pending.text })]
      }
    },

    MintedRequestId: ({ requestId }) => ({ model: modifyFields(model, { draftRequestId: () => Option.some(requestId) }) }),

    // The row shows "saved" until the next list load includes the note, then it becomes an ordinary row.
    SucceededSaveNote: ({ requestId }) => ({
      model: setPending(model, requestId, (p) => (p.phase._tag === "Saving" ? { ...p, phase: Phase.Saved() } : p))
    }),

    FailedSaveNote: ({ requestId, error }) => ({
      model: setPending(model, requestId, (p) => (p.phase._tag === "Saving" ? { ...p, phase: Phase.Failed({ error }) } : p))
    }),

    TickedRefresh: () => (refreshDue(model) ? refresh(model) : { model }), // arc-realtime: the poll rests while live

    SucceededFetchNotes: ({ notes }) =>
      settled(
        modifyFields(model, {
          notes: (current) => AsyncData.settle(current, Result.succeed<ReadonlyArray<Note>>(notes)),
          // A row leaves the pending list once the loaded list shows its note. That includes a
          // Failed row whose reply was lost after the server stored it. Saving rows stay: their
          // own reply decides.
          pending: (ps) => ps.filter((p) => p.phase._tag === "Saving" || !notes.some((n) => n.id === p.requestId)),
          // arc-realtime: the same rule for notes that came over the socket. One the list does
          // not show yet stays: the list was read before that note was stored.
          arrived: (ns) => ns.filter((n) => !notes.some((loaded) => loaded.id === n.id))
        })
      ),

    // Keep the last good list on screen (Stale) instead of blanking it.
    FailedFetchNotes: ({ error }) => settled(modifyFields(model, { notes: (current) => AsyncData.settle(current, Result.fail(error)) })),

    // arc-realtime: the socket ------------------------------------------------

    // Live starts at the server's welcome, not at the socket's open event: the welcome proves
    // the room answered. Then catch up: whatever was stored while this client was away is in
    // the list, so load it. If a load is already in flight it may be older than the socket,
    // so a second one is owed.
    ReceivedWelcome: ({ peer, peers }) => {
      if (model.connection._tag !== "Connecting") return { model }
      const live = modifyFields(model, { connection: () => Connection.Live(), self: () => Option.some(peer), peers: () => peers })
      const load = refresh(live)
      return load.commands === undefined ? { model: modifyFields(live, { catchUpOwed: () => true }) } : load
    },

    ChangedPresence: ({ peers }) => {
      if (model.connection._tag !== "Live") return { model }
      const left = model.direct._tag === "Opening" && !peers.includes(model.direct.peer)
      return { model: modifyFields(model, { peers: () => peers, ...(left ? { direct: () => Direct.Failed({ error: "the other person left" }) } : {}) }) }
    },

    // A note someone saved. It joins `arrived` unless the screen already has it, and it
    // settles a row of our own that is not mid-save, exactly as a list load would.
    ReceivedNote: ({ note }) => ({
      model: modifyFields(model, {
        arrived: (ns) => (known(model, note.id) ? ns : [note, ...ns]),
        pending: (ps) => ps.filter((p) => p.phase._tag === "Saving" || p.requestId !== note.id)
      })
    }),

    ClosedSocket: () => dropped(model),

    // The wait is over. Only the backoff this Model is waiting on may dial again.
    ElapsedBackoff: ({ attempt }) =>
      model.connection._tag === "Reconnecting" && model.connection.attempt === attempt
        ? { model: modifyFields(model, { connection: () => Connection.Connecting({ attempt }) }) }
        : { model },

    ClickedReconnect: () => (model.connection._tag === "Offline" ? { model: modifyFields(model, { connection: () => Connection.Connecting({ attempt: 0 }) }) } : { model }),

    // The server refused a frame this client sent. The only frames it sends are signals.
    RejectedFrame: ({ reason }) => (model.direct._tag === "Opening" ? { model: modifyFields(model, { direct: () => Direct.Failed({ error: reason }) }) } : { model }),

    // A frame that did not decode changes nothing. The Message itself is the record.
    FailedDecodeFrame: () => ({ model }),

    // arc-realtime: the direct link -------------------------------------------

    ClickedConnectDirect: () => startDirect(model),

    ReceivedOffer: ({ from, sdp }) => {
      // Both sides pressed the button at once: the smaller peer id gives way and answers.
      const yields = model.direct._tag === "Opening" && Option.isSome(model.self) && model.self.value < from
      if (model.direct._tag === "Open" || (model.direct._tag === "Opening" && !yields)) return { model }
      return { model: modifyFields(model, { direct: () => Direct.Opening({ peer: from }) }), commands: [AnswerDirect({ from, sdp })] }
    },

    ReceivedAnswer: ({ from, sdp }) => (model.direct._tag === "Opening" && model.direct.peer === from ? { model, commands: [AcceptAnswer({ sdp })] } : { model }),

    // Both report a step that worked. The channel's own open event moves the state.
    SentSignal: () => ({ model }),
    AppliedAnswer: () => ({ model }),

    OpenedDirect: () => {
      const direct = model.direct
      return direct._tag === "Opening" ? { model: modifyFields(model, { direct: () => Direct.Open({ peer: direct.peer }) }) } : { model }
    },

    ClosedDirect: () => (model.direct._tag === "Open" || model.direct._tag === "Opening" ? { model: modifyFields(model, { direct: () => Direct.Idle() }) } : { model }),

    FailedDirect: ({ error }) => ({ model: modifyFields(model, { direct: () => Direct.Failed({ error }) }) }),

    ClickedWave: () => (model.direct._tag === "Open" ? { model, commands: [SendWave()] } : { model }),

    SentWave: () => ({ model: modifyFields(model, { wavesSent: (n) => n + 1 }) }),

    ReceivedWave: () => ({ model: modifyFields(model, { wavesReceived: (n) => n + 1 }) })
  })

// INIT -----------------------------------------------------------------------

export const emptyModel: Model = {
  notes: AsyncData.Loading(),
  draft: "",
  draftRequestId: Option.none(),
  pending: [],
  // arc-realtime: the socket Subscription dials as soon as the Model says Connecting
  connection: Connection.Connecting({ attempt: 0 }),
  self: Option.none(),
  peers: [],
  arrived: [],
  catchUpOwed: false,
  direct: Direct.Idle(),
  wavesSent: 0,
  wavesReceived: 0
}

export const init = (): Return => ({ model: emptyModel, commands: [MintRequestId(), FetchNotes()] })

// SUBSCRIPTIONS --------------------------------------------------------------

export const subscriptions = Subscription.make<Model, Message, RoomSocket | PeerLink>()((entry) => ({
  refresh: Subscription.persistentEntry(Stream.tick(REFRESH_EVERY).pipe(Stream.drop(1), Stream.map(() => Message.TickedRefresh()))),
  // arc-realtime: one socket while the Model wants one. Leaving Connecting or Live drops the
  // stream, which closes the socket; coming back to Connecting starts a new stream, which dials.
  socket: entry({ wanted: Schema.Boolean }, {
    modelToDependencies: (model) => ({ wanted: model.connection._tag === "Connecting" || model.connection._tag === "Live" }),
    dependenciesToStream: ({ wanted }) => (wanted ? socketMessages : Stream.empty)
  }),
  peer: Subscription.persistentEntry(peerMessages)
}))

// VIEW -----------------------------------------------------------------------
// Pure. Event handlers are Messages, not callbacks. Every state has its own branch:
// loading, empty, failure, stale. Controls are found by role and label in tests, so a
// missing label is a test failure.

// arc-realtime: the status shows the socket. Each connection state has its own words; the
// list's own states (loading, empty, failure, stale) are below the list, as before.
const connection = (model: Model) =>
  Connection.match(model.connection, {
    Connecting: ({ attempt }) => (attempt === 0 ? (["pending", "Connecting…"] as const) : (["stale", "Reconnecting…"] as const)),
    Live: () => ["live", "Live"] as const,
    Reconnecting: () => ["stale", "Reconnecting…"] as const,
    Offline: () => ["down", "Offline"] as const
  })

/** The line under the header: who is here while live, and what is happening while not. */
const connectionNote = (model: Model, h: HtmlBuilder<Message>): Html =>
  Connection.match(model.connection, {
    Connecting: ({ attempt }) => (attempt === 0 ? h.empty : h.p([h.Class("dim")], ["The live connection dropped. Trying again."])),
    Live: () => h.p([h.Class("presence")], [model.peers.length <= 1 ? "Only you are here." : `${model.peers.length} people are here.`]),
    Reconnecting: () => h.p([h.Class("dim")], ["The live connection dropped. Trying again."]),
    Offline: () =>
      h.div([h.Class("offline")], [
        h.p([h.Class("error")], [`Live updates stopped after ${MAX_RETRIES} tries. The list still refreshes every few seconds, and notes you add are still sent.`]),
        h.button([h.Type("button"), h.OnClick(Message.ClickedReconnect())], ["Reconnect"])
      ])
  })

/** The direct link: every state says what it is, and each button has its own name. */
const directView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const canStart = model.connection._tag === "Live" && Option.isSome(otherPeer(model))
  const start = (label: string) => (canStart ? [h.button([h.Type("button"), h.OnClick(Message.ClickedConnectDirect())], [label])] : [])
  return h.section([h.AriaLabel("Direct link"), h.Class(`direct ${model.direct._tag.toLowerCase()}`)], [
    h.h2([], ["Direct link"]),
    ...Direct.match(model.direct, {
      Idle: () =>
        canStart
          ? [h.p([h.Class("dim")], ["Open a channel straight to the other person's browser."]), ...start("Connect directly")]
          : [h.p([h.Class("dim")], ["A direct link needs a second person here and a live connection."])],
      Opening: () => [h.p([h.Class("dim")], ["Opening a direct link…"])],
      Open: () => [
        h.p([h.Class("direct-state")], ["Direct link open."]),
        h.button([h.Type("button"), h.OnClick(Message.ClickedWave())], ["Wave"]),
        h.p([h.Class("waves")], [`Waves sent ${model.wavesSent}, received ${model.wavesReceived}.`])
      ],
      // The Message keeps the technical cause; the screen says what still works.
      Failed: () => [h.p([h.Class("error")], ["The direct link didn't open. Notes still sync through the server."]), ...start("Try again")]
    })
  ])
}

const composer = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.form([h.OnSubmit(Message.SubmittedNote()), h.AriaLabel("Add a note"), h.Class("composer")], [
    h.label([h.For("draft")], ["Note"]),
    h.div([h.Class("field")], [
      h.input([h.Id("draft"), h.Value(model.draft), h.Autocomplete("off"), h.OnInput((text) => Message.ChangedDraft({ text }))]),
      h.button([h.Type("submit"), h.Disabled(model.draft.trim() === "" || Option.isNone(model.draftRequestId))], ["Add"])
    ])
  ])

const phaseLabel = (phase: Phase): string => Phase.match(phase, { Saving: () => "saving", Saved: () => "saved", Failed: () => "not saved" })

const pendingView = (pending: Pending, h: HtmlBuilder<Message>): Html =>
  // Keyed by requestId, which is also the saved note's id, so the row keeps its DOM node
  // while its phase changes and when it becomes an ordinary note. The phase class is what
  // the state-change fade hangs on.
  h.keyed("li")(pending.requestId, [h.Class(`item is-pending ${pending.phase._tag.toLowerCase()}`)], [
    h.span([h.Class("text")], [pending.text]),
    h.span([h.Class("badge")], [phaseLabel(pending.phase)]),
    ...Phase.match(pending.phase, {
      Saving: () => [],
      Saved: () => [],
      // The Message keeps the technical cause for tests and DevTools; the screen says it plainly.
      Failed: () => [
        h.p([h.Class("error")], ["Couldn't save this note. Check your connection and retry."]),
        h.button([h.Type("button"), h.OnClick(Message.ClickedRetry({ requestId: pending.requestId })), h.AriaLabel(`Retry ${pending.text}`)], ["Retry"])
      ]
    })
  ])

const noteView = (note: Note, h: HtmlBuilder<Message>): Html =>
  h.keyed("li")(note.id, [h.Class("item")], [h.span([h.Class("text")], [note.text])])

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const [tone, label] = connection(model)
  const unsaved = model.pending.filter((p) => p.phase._tag !== "Saved").length
  const loaded = Option.getOrElse(AsyncData.getData(model.notes), (): ReadonlyArray<Note> => [])
  return {
    title: unsaved > 0 ? `(${unsaved}) Notes` : "Notes",
    body: h.main([h.Class("app")], [
      h.header([h.Class("top")], [
        h.h1([], ["Notes"]),
        h.span([h.Class(`conn ${tone}`), h.Role("status"), h.AriaLive("polite")], [label])
      ]),
      connectionNote(model, h), // arc-realtime
      composer(model, h),
      h.section([h.AriaLabel("Notes list")], [
        // One list: unsaved rows first, then notes from the socket, then loaded notes. A note
        // shows once, in the first of those that has it.
        h.ul([h.Class("items")], [
          ...model.pending.map((p) => pendingView(p, h)),
          ...[...model.arrived, ...loaded.filter((n) => !model.arrived.some((a) => a.id === n.id))]
            .filter((n) => !model.pending.some((p) => p.requestId === n.id))
            .map((n) => noteView(n, h))
        ]),
        AsyncData.matchData(model.notes, {
          onEmpty: () => (model.arrived.length === 0 ? h.p([h.Class("dim")], ["Loading…"]) : h.empty),
          onFailure: () => h.p([h.Class("error")], ["Couldn't load notes. Retrying every few seconds."]),
          onData: (notes) =>
            notes.length === 0 && model.pending.length === 0 && model.arrived.length === 0
              ? h.p([h.Class("dim")], ["No notes yet. Add the first one above."])
              : // arc-realtime: the stale state. The last good list stays, and says so.
                model.notes._tag === "Stale"
                ? h.p([h.Class("dim")], ["Couldn't refresh the list. These are the last notes received."])
                : h.empty
        })
      ]),
      directView(model, h) // arc-realtime
    ])
  }
}
