/**
 * Command tests: run a Command's Effect against a stub HttpClient, so the URL, the body,
 * response decoding and the retry are exercised with no server. Run: node test/commands.test.ts
 */
import assert from "node:assert/strict"
import { Effect, Layer } from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http"
import { FetchNotes, SaveNote } from "../src/commands.ts"
import { Message } from "../src/model.ts"

type Seen = { method: string; url: string; body: string }

/** A client that records each request and answers from `reply`, one call at a time. */
const stub = (reply: (call: number) => Response) => {
  const seen: Array<Seen> = []
  const client = HttpClient.make((request, url) =>
    Effect.sync(() => {
      const body = request.body._tag === "Uint8Array" ? new TextDecoder().decode(request.body.body) : ""
      seen.push({ method: request.method, url: url.pathname, body })
      return HttpClientResponse.fromWeb(request, reply(seen.length))
    })
  )
  // Commands use relative URLs (same origin in the browser). Node has no origin, so give one.
  const based = client.pipe(HttpClient.mapRequest(HttpClientRequest.prependUrl("http://app.test")))
  return { seen, layer: Layer.succeed(HttpClient.HttpClient, based) }
}
const run = <A>(effect: Effect.Effect<A, never, HttpClient.HttpClient>, layer: Layer.Layer<HttpClient.HttpClient>) =>
  Effect.runPromise(effect.pipe(Effect.provide(layer)))

// A 503 is retried with the SAME body (the key), then the save succeeds.
{
  const { seen, layer } = stub((call) => (call === 1 ? new Response("busy", { status: 503 }) : Response.json({ id: "k1" })))
  const message = await run(SaveNote({ requestId: "k1", text: "buy milk" }).effect, layer)
  assert.deepEqual(message, Message.SucceededSaveNote({ requestId: "k1" }))
  assert.equal(seen.length, 2)
  assert.deepEqual(seen.map((s) => [s.method, s.url]), [["POST", "/api/notes"], ["POST", "/api/notes"]])
  assert.equal(seen[0]!.body, seen[1]!.body)
  assert.deepEqual(JSON.parse(seen[0]!.body), { id: "k1", text: "buy milk" })
}
console.log("ok  command: a 503 is retried with the same key, then succeeds")

// A 400 is not transient: no retry, and the failure becomes a Message.
{
  const { seen, layer } = stub(() => Response.json({ error: "bad" }, { status: 400 }))
  const message = await run(SaveNote({ requestId: "k2", text: "x" }).effect, layer)
  assert.equal(message._tag, "FailedSaveNote")
  assert.equal(seen.length, 1)
}
console.log("ok  command: a 400 fails once, as a Message")

// Responses are decoded: a malformed list becomes FailedFetchNotes, not a crash.
{
  const good = stub(() => Response.json([{ id: "n1", text: "first note" }]))
  assert.deepEqual(await run(FetchNotes().effect, good.layer), Message.SucceededFetchNotes({ notes: [{ id: "n1", text: "first note" }] }))
  const bad = stub(() => Response.json([{ id: 1 }]))
  assert.equal((await run(FetchNotes().effect, bad.layer))._tag, "FailedFetchNotes")
}
console.log("ok  command: the list is decoded; a malformed one fails as a Message")
