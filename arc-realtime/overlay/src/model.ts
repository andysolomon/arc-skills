/**
 * MODEL and MESSAGES. Data definitions only: no runtime, no DOM.
 *
 * The rule this app is built around: the idempotency key is minted once per intent and
 * kept in the Model. The draft has its `requestId` before Add is pressed and a retry
 * reuses it, so a double-click or a lost reply can't save the note twice. The server uses
 * the same key as the note's id.
 */
import { Schema } from "effect"
import { AsyncData } from "foldkit"
import { defineMessageUnion } from "foldkit/message"
import { defineTaggedUnion } from "foldkit/schema"

export const Note = Schema.Struct({ id: Schema.String, text: Schema.String })
export type Note = typeof Note.Type

export const Notes = Schema.Array(Note)

/** Where one unsaved note is in its life. */
export const Phase = defineTaggedUnion({
  Saving: {},
  /** The server has it. It stays here until the next list load shows it. */
  Saved: {},
  /** Every automatic retry failed. The Retry button re-sends with the SAME requestId. */
  Failed: { error: Schema.String }
})
export type Phase = typeof Phase.Type

export const Pending = Schema.Struct({ requestId: Schema.String, text: Schema.String, phase: Phase })
export type Pending = typeof Pending.Type

export const NotesData = AsyncData.Schema(Notes, Schema.String)

// arc-realtime ---------------------------------------------------------------
/** The room socket's life. Every case has its own screen text in `view`. */
export const Connection = defineTaggedUnion({
  /** A socket is opening. `attempt` counts the failures since it was last live; 0 is the first try. */
  Connecting: { attempt: Schema.Number },
  /** The server's welcome frame arrived. */
  Live: {},
  /** The socket closed. Waiting out the backoff before try number `attempt`. */
  Reconnecting: { attempt: Schema.Number },
  /** Every retry failed. Only the Reconnect button leaves this state. */
  Offline: {}
})
export type Connection = typeof Connection.Type

/** The browser-to-browser channel (WebRTC). Its handshake travels over the room socket. */
export const Direct = defineTaggedUnion({
  Idle: {},
  /** An offer or an answer is on its way to `peer`. */
  Opening: { peer: Schema.String },
  Open: { peer: Schema.String },
  Failed: { error: Schema.String }
})
export type Direct = typeof Direct.Type
// ------------------------------------------------------------- arc-realtime

export const Model = Schema.Struct({
  /** Refreshing and Stale keep the last good list on screen. */
  notes: NotesData.schema,
  draft: Schema.String,
  /** The key for whatever the draft becomes. None until MintRequestId answers. */
  draftRequestId: Schema.Option(Schema.String),
  /** Newest first. */
  pending: Schema.Array(Pending),
  // arc-realtime
  connection: Connection,
  /** This client's peer id, minted by the server. None until the welcome frame. */
  self: Schema.Option(Schema.String),
  /** Everyone connected right now, this client included. Empty while not live: unknown, not zero. */
  peers: Schema.Array(Schema.String),
  /** Notes that arrived over the socket and that no list load has shown yet. Newest first. */
  arrived: Notes,
  /** A list load is owed: one was already in flight when the socket went live. */
  catchUpOwed: Schema.Boolean,
  direct: Direct,
  wavesSent: Schema.Number,
  wavesReceived: Schema.Number
})
export type Model = typeof Model.Type

/** Messages are facts in the past tense, grouped below by their source: the user, a Command, a Subscription. */
export const Message = defineMessageUnion({
  // From the user
  ChangedDraft: { text: Schema.String },
  SubmittedNote: {},
  ClickedRetry: { requestId: Schema.String },
  // From Commands
  MintedRequestId: { requestId: Schema.String },
  SucceededFetchNotes: { notes: Notes },
  FailedFetchNotes: { error: Schema.String },
  SucceededSaveNote: { requestId: Schema.String },
  FailedSaveNote: { requestId: Schema.String, error: Schema.String },
  // From Subscriptions
  TickedRefresh: {},
  // arc-realtime, from the user
  ClickedReconnect: {},
  ClickedConnectDirect: {},
  ClickedWave: {},
  // arc-realtime, from Commands
  ElapsedBackoff: { attempt: Schema.Number },
  SentSignal: { to: Schema.String },
  AppliedAnswer: {},
  SentWave: {},
  FailedDirect: { error: Schema.String },
  // arc-realtime, from the socket Subscription: one Message per frame type, decoded in realtime.ts
  ReceivedWelcome: { peer: Schema.String, peers: Schema.Array(Schema.String) },
  ChangedPresence: { peers: Schema.Array(Schema.String) },
  ReceivedNote: { note: Note },
  ReceivedOffer: { from: Schema.String, sdp: Schema.String },
  ReceivedAnswer: { from: Schema.String, sdp: Schema.String },
  RejectedFrame: { reason: Schema.String },
  /** A frame that did not decode. The cause stays here for tests and DevTools. */
  FailedDecodeFrame: { error: Schema.String },
  ClosedSocket: { code: Schema.Number },
  // arc-realtime, from the peer Subscription
  OpenedDirect: {},
  ReceivedWave: {},
  ClosedDirect: {}
})
export type Message = typeof Message.Type
