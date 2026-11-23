/**
 * The room protocol, written once and used by both servers: cloudflare/worker.ts and
 * scripts/mock-api.ts. Plain TypeScript with no platform types, so it loads on workerd and
 * in Node. A frame is one JSON text message on the socket at ROOM_PATH.
 *
 *   server to client
 *     { type: "welcome",  peer, peers }      once, after the socket is accepted
 *     { type: "presence", peers }            to everyone, when someone joins or leaves
 *     { type: "note",     note: {id, text} } to everyone, when a note is stored
 *     { type: "signal",   from, kind, sdp }  to one peer, relayed from another (WebRTC)
 *     { type: "rejected", reason }           to the sender of a frame that failed a check
 *
 *   client to server
 *     { type: "add",    id, text }           the same write as POST /api/notes, same key
 *     { type: "signal", to, kind, sdp }      relayed to peer `to`
 *
 * The server never trusts a frame: every one goes through `parseClientFrame`. The size
 * caps below are this app's own choices, not platform limits.
 */
export const ROOM_PATH = "/api/room"
export const MAX_TEXT = 2000
export const MAX_FRAME = 16_000
export const MAX_SDP = 12_000

export type Note = { readonly id: string; readonly text: string }
type Checked<A> = { readonly ok: true; readonly value: A } | { readonly ok: false; readonly error: string }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** One check for a note, used by the HTTP route and by the `add` frame. */
export const checkNote = (body: unknown): Checked<Note> => {
  if (!isRecord(body)) return { ok: false, error: "the body must be an object" }
  const { id, text } = body
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return { ok: false, error: "id must be a string of 1 to 64 characters" }
  if (typeof text !== "string" || text.trim() === "" || text.length > MAX_TEXT) return { ok: false, error: `text must be 1 to ${MAX_TEXT} characters` }
  return { ok: true, value: { id, text } }
}

export type ClientFrame =
  | { readonly type: "add"; readonly note: Note }
  | { readonly type: "signal"; readonly to: string; readonly kind: "offer" | "answer"; readonly sdp: string }

export const parseClientFrame = (raw: unknown): Checked<ClientFrame> => {
  if (typeof raw !== "string") return { ok: false, error: "frames must be text" }
  if (raw.length > MAX_FRAME) return { ok: false, error: `a frame is at most ${MAX_FRAME} characters` }
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return { ok: false, error: "invalid JSON" }
  }
  if (!isRecord(body)) return { ok: false, error: "a frame must be an object" }
  if (body.type === "add") {
    const note = checkNote(body)
    return note.ok ? { ok: true, value: { type: "add", note: note.value } } : note
  }
  if (body.type === "signal") {
    const { to, kind, sdp } = body
    if (typeof to !== "string" || to.length === 0 || to.length > 64) return { ok: false, error: "to must be a peer id" }
    if (kind !== "offer" && kind !== "answer") return { ok: false, error: "kind must be offer or answer" }
    if (typeof sdp !== "string" || sdp.length === 0 || sdp.length > MAX_SDP) return { ok: false, error: `sdp must be 1 to ${MAX_SDP} characters` }
    return { ok: true, value: { type: "signal", to, kind, sdp } }
  }
  return { ok: false, error: "unknown frame type" }
}

export const frames = {
  welcome: (peer: string, peers: ReadonlyArray<string>) => JSON.stringify({ type: "welcome", peer, peers }),
  presence: (peers: ReadonlyArray<string>) => JSON.stringify({ type: "presence", peers }),
  note: (note: Note) => JSON.stringify({ type: "note", note }),
  signal: (from: string, kind: "offer" | "answer", sdp: string) => JSON.stringify({ type: "signal", from, kind, sdp }),
  rejected: (reason: string) => JSON.stringify({ type: "rejected", reason })
}
