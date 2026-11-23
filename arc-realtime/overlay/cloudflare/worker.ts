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
// arc-realtime: the room protocol, shared with scripts/mock-api.ts
import { checkNote, frames, type Note, parseClientFrame, ROOM_PATH } from "./room.ts"

interface Env {
  readonly NOTES: DurableObjectNamespace<Notes>
}

const json = (status: number, body: unknown) => Response.json(body, { status })

export class Notes extends DurableObject<Env> {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env)
    state.storage.sql.exec("CREATE TABLE IF NOT EXISTS notes (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, text TEXT NOT NULL)")
  }

  override async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname
    if (path === ROOM_PATH) return this.join(request) // arc-realtime
    if (path !== "/api/notes") return json(404, { error: "not found" })
    const sql = this.ctx.storage.sql
    if (request.method === "GET") return json(200, sql.exec("SELECT id, text FROM notes ORDER BY seq DESC LIMIT 200").toArray())
    if (request.method !== "POST") return json(405, { error: "method not allowed" })

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return json(400, { error: "invalid JSON" })
    }
    const note = checkNote(body)
    if (!note.ok) return json(400, { error: note.error })
    this.store(note.value)
    return json(200, { id: note.value.id })
  }

  /**
   * The one write, used by POST and by the `add` frame. The id is the idempotency key: a
   * second insert with the same id is ignored, and only a new note is announced.
   */
  private store(note: Note): void {
    // RETURNING yields a row only when the insert stored one. (The cursor's rowsWritten is not
    // zero for an ignored insert on local workerd, so it cannot answer this.)
    const stored = this.ctx.storage.sql.exec("INSERT OR IGNORE INTO notes (id, text) VALUES (?, ?) RETURNING id", note.id, note.text).toArray()
    if (stored.length > 0) this.broadcast(frames.note(note)) // arc-realtime
  }

  // arc-realtime -------------------------------------------------------------
  // The room. Sockets are accepted with the hibernation API (`ctx.acceptWebSocket`), so the
  // runtime holds them and calls `webSocketMessage` and `webSocketClose` on this class. No
  // socket lives in a field: after a restart `ctx.getWebSockets()` still lists them, and
  // each socket's tag is its peer id, which the server minted.

  private join(request: Request): Response {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json(426, { error: "this route is a WebSocket" })
    const pair = new WebSocketPair()
    const peer = crypto.randomUUID()
    this.ctx.acceptWebSocket(pair[1], [peer])
    const peers = this.peers()
    pair[1].send(frames.welcome(peer, peers))
    this.broadcast(frames.presence(peers), peer)
    return new Response(null, { status: 101, webSocket: pair[0] })
  }

  private peerOf(ws: WebSocket): string {
    return this.ctx.getTags(ws)[0] ?? ""
  }

  private peers(except?: string): Array<string> {
    return this.ctx.getWebSockets().map((ws) => this.peerOf(ws)).filter((peer) => peer !== except)
  }

  private broadcast(frame: string, except?: string): void {
    for (const ws of this.ctx.getWebSockets()) {
      if (this.peerOf(ws) === except) continue
      try {
        ws.send(frame)
      } catch {
        // a socket that is closing: its own close event updates presence
      }
    }
  }

  override webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    const frame = parseClientFrame(message)
    if (!frame.ok) return ws.send(frames.rejected(frame.error))
    if (frame.value.type === "add") return this.store(frame.value.note)
    const target = this.ctx.getWebSockets(frame.value.to)[0]
    if (target === undefined) return ws.send(frames.rejected("that peer is not here"))
    target.send(frames.signal(this.peerOf(ws), frame.value.kind, frame.value.sdp))
  }

  override webSocketClose(ws: WebSocket): void {
    const peer = this.peerOf(ws)
    // Without this reply the client never sees its close finish (seen on local workerd).
    try {
      ws.close(1000, "closed")
    } catch {
      // already closed
    }
    this.broadcast(frames.presence(this.peers(peer)), peer)
  }

  override webSocketError(ws: WebSocket): void {
    const peer = this.peerOf(ws)
    this.broadcast(frames.presence(this.peers(peer)), peer)
  }
}

export default {
  fetch: (request, env) => env.NOTES.getByName("root").fetch(request)
} satisfies ExportedHandler<Env>
