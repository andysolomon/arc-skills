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

export const Model = Schema.Struct({
  /** Refreshing and Stale keep the last good list on screen. */
  notes: NotesData.schema,
  draft: Schema.String,
  /** The key for whatever the draft becomes. None until MintRequestId answers. */
  draftRequestId: Schema.Option(Schema.String),
  /** Newest first. */
  pending: Schema.Array(Pending)
})
export type Model = typeof Model.Type

/** Messages are facts in the past tense: who did what, or what came back. */
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
  TickedRefresh: {}
})
export type Message = typeof Message.Type
