/**
 * The API on Cloudflare: one Worker in front of one Durable Object that keeps the notes in
 * its own SQLite. The built web app is served by the same Worker (see alchemy.run.ts), so
 * the browser's relative `/api/notes` requests are same-origin.
 *
 * The rule the client relies on: POST is idempotent on the note's id. A retried save, or a
 * save whose reply was lost, changes nothing and answers 200.
 *
 * This demo has one shared list and no sign-in. Add authentication before real use.
 */
import { DurableObject } from "cloudflare:workers"

interface Env {
  readonly NOTES: DurableObjectNamespace<Notes>
}

const MAX_TEXT = 2000
const json = (status: number, body: unknown) => Response.json(body, { status })

export class Notes extends DurableObject<Env> {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env)
    state.storage.sql.exec("CREATE TABLE IF NOT EXISTS notes (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, text TEXT NOT NULL)")
  }

  override async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname !== "/api/notes") return json(404, { error: "not found" })
    const sql = this.ctx.storage.sql
    if (request.method === "GET") return json(200, sql.exec("SELECT id, text FROM notes ORDER BY seq DESC LIMIT 200").toArray())
    if (request.method !== "POST") return json(405, { error: "method not allowed" })

    let body: { id?: unknown; text?: unknown }
    try {
      body = await request.json()
    } catch {
      return json(400, { error: "invalid JSON" })
    }
    const { id, text } = body
    if (typeof id !== "string" || id.length === 0 || id.length > 64) return json(400, { error: "id must be a string of 1 to 64 characters" })
    if (typeof text !== "string" || text.trim() === "" || text.length > MAX_TEXT) return json(400, { error: `text must be 1 to ${MAX_TEXT} characters` })

    // The id is the idempotency key: a second insert with the same id is ignored.
    sql.exec("INSERT OR IGNORE INTO notes (id, text) VALUES (?, ?)", id, text)
    return json(200, { id })
  }
}

export default {
  fetch: (request, env) => env.NOTES.getByName("root").fetch(request)
} satisfies ExportedHandler<Env>
