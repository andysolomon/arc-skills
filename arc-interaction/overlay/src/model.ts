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

// arc-interaction: a removal is a write on an existing note, so it has its own phase union
// and its key is the note's id. A repeat of the same DELETE changes nothing.
/** Where one removal is in its life. */
export const RemovePhase = defineTaggedUnion({
  /** The request is in flight. The row is hidden and its neighbours have closed the gap. */
  Removing: {},
  /** The server has removed it. It stays here, hidden, until a list load no longer shows the note. */
  Removed: {},
  /** Every automatic retry failed. The row is back on screen with Retry and Keep. */
  Failed: { error: Schema.String }
})
export type RemovePhase = typeof RemovePhase.Type

export const Removal = Schema.Struct({ noteId: Schema.String, phase: RemovePhase })
export type Removal = typeof Removal.Type

export const NotesData = AsyncData.Schema(Notes, Schema.String)

export const Model = Schema.Struct({
  /** Refreshing and Stale keep the last good list on screen. */
  notes: NotesData.schema,
  draft: Schema.String,
  /** The key for whatever the draft becomes. None until MintRequestId answers. */
  draftRequestId: Schema.Option(Schema.String),
  /** Newest first. */
  pending: Schema.Array(Pending),
  /** arc-interaction: one entry per note that is being removed, keyed by the note's id. */
  removing: Schema.Array(Removal)
})
export type Model = typeof Model.Type

/** Messages are facts in the past tense, grouped below by their source: the user, a Mount, a Command, a Subscription. */
export const Message = defineMessageUnion({
  // From the user
  ChangedDraft: { text: Schema.String },
  SubmittedNote: {},
  ClickedRetry: { requestId: Schema.String },
  // arc-interaction: the button path. It does what the swipe does, for keyboards and screen readers.
  ClickedRemove: { noteId: Schema.String },
  ClickedRetryRemove: { noteId: Schema.String },
  ClickedKeep: { noteId: Schema.String },
  // From Mounts (arc-interaction). A gesture ends in one fact; `update` decides what it means.
  CompletedAttachSwipe: {},
  SwipedAwayNote: { noteId: Schema.String },
  CompletedMoveRows: {},
  CompletedDrawEmptyFigure: {},
  // From Commands
  MintedRequestId: { requestId: Schema.String },
  SucceededFetchNotes: { notes: Notes },
  FailedFetchNotes: { error: Schema.String },
  SucceededSaveNote: { requestId: Schema.String },
  FailedSaveNote: { requestId: Schema.String, error: Schema.String },
  SucceededRemoveNote: { noteId: Schema.String },
  FailedRemoveNote: { noteId: Schema.String, error: Schema.String },
  // From Subscriptions
  TickedRefresh: {}
})
export type Message = typeof Message.Type
