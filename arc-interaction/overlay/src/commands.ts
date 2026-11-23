/**
 * COMMANDS: every side effect the UI can ask for, as named values.
 *
 * Each one needs an `HttpClient` from context and never says which one: the browser gets
 * Foldkit's fetch-backed `Http.layer` through `resources`, and a test can supply its own.
 * Every failure becomes a Message, so each Command's error channel is `never`.
 */
import { Effect, Schedule, Schema } from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http"
import { Command } from "foldkit"
import { Message, Notes } from "./model.ts"

const describe = (error: unknown): string => {
  const e = error as { _tag?: string; message?: string }
  return e?.message ? `${e._tag ?? "Error"}: ${e.message}` : String(error)
}

/** Randomness is a side effect, so it is a Command. `update` stays pure and replayable. */
export const MintRequestId = Command.define("MintRequestId", {
  messages: [Message.MintedRequestId],
  execute: Effect.sync(() => Message.MintedRequestId({ requestId: crypto.randomUUID() }))
})

export const FetchNotes = Command.define("FetchNotes", {
  messages: [Message.SucceededFetchNotes, Message.FailedFetchNotes],
  execute: Effect.gen(function*() {
    const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk)
    const notes = yield* client.get("/api/notes").pipe(Effect.flatMap(HttpClientResponse.schemaBodyJson(Notes)))
    return Message.SucceededFetchNotes({ notes })
  }).pipe(Effect.catch((error) => Effect.succeed(Message.FailedFetchNotes({ error: describe(error) }))))
})

/**
 * Retries transient failures (a network error, a 5xx) a few times with backoff, re-sending the SAME body.
 * That is safe only because the body carries the idempotency key.
 */
export const SaveNote = Command.define("SaveNote", {
  args: { requestId: Schema.String, text: Schema.String },
  messages: [Message.SucceededSaveNote, Message.FailedSaveNote],
  execute: ({ requestId, text }) =>
    Effect.gen(function*() {
      const client = (yield* HttpClient.HttpClient).pipe(
        HttpClient.retryTransient({ schedule: Schedule.exponential("200 millis"), times: 3 }),
        HttpClient.filterStatusOk
      )
      const request = HttpClientRequest.post("/api/notes").pipe(HttpClientRequest.bodyJsonUnsafe({ id: requestId, text }))
      yield* client.execute(request)
      return Message.SucceededSaveNote({ requestId })
    }).pipe(Effect.catch((error) => Effect.succeed(Message.FailedSaveNote({ requestId, error: describe(error) }))))
})

/**
 * arc-interaction: removes one note. The note's id is the key and it travels in the URL, so
 * a retry sends the same request and a note that is already gone still answers 200.
 */
export const RemoveNote = Command.define("RemoveNote", {
  args: { noteId: Schema.String },
  messages: [Message.SucceededRemoveNote, Message.FailedRemoveNote],
  execute: ({ noteId }) =>
    Effect.gen(function*() {
      const client = (yield* HttpClient.HttpClient).pipe(
        HttpClient.retryTransient({ schedule: Schedule.exponential("200 millis"), times: 3 }),
        HttpClient.filterStatusOk
      )
      yield* client.del(`/api/notes/${encodeURIComponent(noteId)}`)
      return Message.SucceededRemoveNote({ noteId })
    }).pipe(Effect.catch((error) => Effect.succeed(Message.FailedRemoveNote({ noteId, error: describe(error) }))))
})
