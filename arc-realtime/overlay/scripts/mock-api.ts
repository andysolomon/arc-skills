/**
 * A stand-in API for local work: npm run mock  (127.0.0.1:8787, memory only). It mirrors
 * cloudflare/worker.ts; change both together, and run scripts/api-check.ts against each.
 * It keeps the one rule a real API must keep: POST is idempotent on the note's id, so a
 * retried save answers 200 and stores nothing new.
 *
 * arc-realtime: it also serves the room socket at /api/room with the `ws` package. Both
 * servers run the same frame checks, from cloudflare/room.ts.
 *
 * Switches, to put the app in each state for step 9 ("Look at it"):
 *   DELAY_MS=1500        every reply waits, so Loading and Saving stay on screen. The socket
 *                        handshake waits too, so "Connecting…" stays on screen
 *   FAIL_SAVES=1         every save answers 500: after its retries the row shows "not saved"
 *   FAIL_FIRST_SAVE=1    stores the first save, then drops its reply (a lost reply)
 *   REFUSE_SOCKETS=1     every socket handshake answers 503 while HTTP keeps working: the app
 *                        shows "Reconnecting…" through its backoff, then "Offline"
 *   DROP_SOCKET_AFTER_MS=4000   closes each socket that long after it opens: the app goes
 *                        live, reconnecting, live again, and reloads the list each time
 *   stop the process     HTTP and the socket both fail: the last list stays (stale), and the
 *                        status goes "Reconnecting…", then "Offline"
 *   PORT=8787            where it listens
 */
import { randomUUID } from "node:crypto"
import { createServer } from "node:http"
import { type WebSocket, WebSocketServer } from "ws"
import { checkNote, frames, type Note, parseClientFrame, ROOM_PATH } from "../cloudflare/room.ts"

const notes: Array<Note> = []
let dropNext = process.env.FAIL_FIRST_SAVE === "1"
const failSaves = process.env.FAIL_SAVES === "1"
const delay = Number(process.env.DELAY_MS ?? 0)
const refuseSockets = process.env.REFUSE_SOCKETS === "1"
const dropSocketAfter = Number(process.env.DROP_SOCKET_AFTER_MS ?? 0)

const server = createServer((req, res) => setTimeout(() => handle(req, res), delay))

/** The one write, used by POST and by the `add` frame: a known id stores nothing and announces nothing. */
function store(note: Note) {
  if (notes.some((n) => n.id === note.id)) return
  notes.unshift(note)
  broadcast(frames.note(note))
}

function handle(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) {
  const json = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" })
    res.end(JSON.stringify(body))
  }
  if (req.url === ROOM_PATH) return json(426, { error: "this route is a WebSocket" })
  if (req.url !== "/api/notes") return json(404, { error: "not found" })
  if (req.method === "GET") return json(200, notes)
  if (req.method !== "POST") return json(405, { error: "method not allowed" })
  if (failSaves) return json(500, { error: "FAIL_SAVES is set" })
  let raw = ""
  req.on("data", (chunk) => (raw += chunk))
  req.on("end", () => {
    let body: unknown
    try { body = JSON.parse(raw) } catch { return json(400, { error: "invalid JSON" }) }
    const note = checkNote(body)
    if (!note.ok) return json(400, { error: note.error })
    store(note.value)
    if (dropNext) { dropNext = false; return res.destroy() } // stored, but the reply is lost
    json(200, { id: note.value.id })
  })
}

// arc-realtime: the room ------------------------------------------------------
const room = new Map<string, WebSocket>() // peer id, minted here, to its socket
const sockets = new WebSocketServer({ noServer: true })

function broadcast(frame: string, except?: string) {
  for (const [peer, ws] of room) if (peer !== except && ws.readyState === ws.OPEN) ws.send(frame)
}

server.on("upgrade", (req, socket, head) =>
  setTimeout(() => {
    if (req.url !== ROOM_PATH || refuseSockets) return socket.end(`HTTP/1.1 ${refuseSockets ? "503 Service Unavailable" : "404 Not Found"}\r\nConnection: close\r\n\r\n`)
    sockets.handleUpgrade(req, socket, head, (ws) => {
      const peer = randomUUID()
      room.set(peer, ws)
      ws.send(frames.welcome(peer, [...room.keys()]))
      broadcast(frames.presence([...room.keys()]), peer)
      if (dropSocketAfter > 0) setTimeout(() => ws.close(1012, "DROP_SOCKET_AFTER_MS is set"), dropSocketAfter)
      ws.on("message", (data, isBinary) => {
        const frame = parseClientFrame(isBinary ? data : data.toString())
        if (!frame.ok) return ws.send(frames.rejected(frame.error))
        if (frame.value.type === "add") return store(frame.value.note)
        const target = room.get(frame.value.to)
        if (target === undefined) return ws.send(frames.rejected("that peer is not here"))
        if (target.readyState === target.OPEN) target.send(frames.signal(peer, frame.value.kind, frame.value.sdp))
      })
      ws.on("close", () => {
        room.delete(peer)
        broadcast(frames.presence([...room.keys()]))
      })
      ws.on("error", () => ws.terminate())
    })
  }, delay)
)

server.listen(Number(process.env.PORT ?? 8787), "127.0.0.1", () => console.log("mock API on http://127.0.0.1:" + (process.env.PORT ?? 8787)))
