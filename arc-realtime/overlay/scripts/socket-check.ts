/**
 * arc-realtime: checks the room socket against the contract the app relies on. Called by
 * scripts/api-check.ts, so `npm run api:check -- <url>` covers HTTP and the socket. Uses
 * Node's own WebSocket client. Writes a few notes with random ids, so run it on local or
 * test data only.
 */
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

type Frame = { type: string; peer?: string; peers?: Array<string>; note?: { id: string; text: string }; from?: string; kind?: string; sdp?: string; reason?: string }

/** One socket that keeps every frame it receives, so a check can wait for the one it expects. */
const open = async (url: string) => {
  const ws = new WebSocket(url)
  const seen: Array<Frame> = []
  let wake = () => {}
  ws.addEventListener("message", (event) => {
    seen.push(JSON.parse(String(event.data)) as Frame)
    wake()
  })
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => resolve())
    ws.addEventListener("error", () => reject(new Error(`could not open ${url}`)))
  })
  /** Waits for the first frame that matches and has not been taken yet. Fails after 5 seconds. */
  const next = async (label: string, match: (frame: Frame) => boolean): Promise<Frame> => {
    const deadline = Date.now() + 5000
    for (;;) {
      const at = seen.findIndex(match)
      if (at >= 0) return seen.splice(at, 1)[0]!
      const left = deadline - Date.now()
      assert.ok(left > 0, `no frame arrived: ${label}`)
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, left)
        wake = () => {
          clearTimeout(timer)
          resolve()
        }
      })
    }
  }
  return { ws, seen, next, send: (frame: unknown) => ws.send(typeof frame === "string" ? frame : JSON.stringify(frame)) }
}

export const checkSocket = async (base: string): Promise<void> => {
  const notesUrl = `${base}/api/notes`
  const roomUrl = `${base.replace(/^http/, "ws")}/api/room`
  const post = (note: { id: string; text: string }) => fetch(notesUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(note) })
  const stored = async (id: string) => ((await (await fetch(notesUrl)).json()) as Array<{ id: string }>).filter((n) => n.id === id).length
  const isNote = (id: string) => (frame: Frame) => frame.type === "note" && frame.note?.id === id

  assert.equal((await fetch(`${base}/api/room`)).status, 426, "a plain GET on the room answers 426")

  // Presence: each socket is told who it is and who is here, and the others are told when it joins.
  const a = await open(roomUrl)
  const welcomeA = await a.next("welcome for the first socket", (f) => f.type === "welcome")
  const peerA = welcomeA.peer!
  assert.ok(typeof peerA === "string" && welcomeA.peers!.includes(peerA), "welcome names the socket's own peer id")
  const b = await open(roomUrl)
  const welcomeB = await b.next("welcome for the second socket", (f) => f.type === "welcome")
  const peerB = welcomeB.peer!
  assert.ok(welcomeB.peers!.includes(peerA) && welcomeB.peers!.includes(peerB), "the second welcome lists both peers")
  await a.next("presence after a join", (f) => f.type === "presence" && f.peers!.includes(peerB))

  // A note saved over HTTP reaches every socket, once.
  const viaHttp = { id: `socket-check-${randomUUID()}`, text: "saved over HTTP" }
  const sentinel = { id: `socket-check-${randomUUID()}`, text: "sentinel" }
  assert.equal((await post(viaHttp)).status, 200)
  assert.deepEqual((await a.next("note frame on the first socket", isNote(viaHttp.id))).note, viaHttp)
  assert.deepEqual((await b.next("note frame on the second socket", isNote(viaHttp.id))).note, viaHttp)
  assert.equal((await post(viaHttp)).status, 200, "the same save again answers 200")
  assert.equal((await post(sentinel)).status, 200)
  await b.next("sentinel note", isNote(sentinel.id))
  assert.equal(b.seen.filter(isNote(viaHttp.id)).length, 0, "a repeated save is not announced again")

  // The `add` frame is the same write: stored once, announced once.
  const viaFrame = { id: `socket-check-${randomUUID()}`, text: "saved over the socket" }
  a.send({ type: "add", ...viaFrame })
  assert.deepEqual((await b.next("note frame from an add frame", isNote(viaFrame.id))).note, viaFrame)
  a.send({ type: "add", ...viaFrame })
  a.send({ type: "add", id: `socket-check-${randomUUID()}`, text: "second sentinel" })
  await b.next("second sentinel", (f) => f.type === "note" && f.note?.text === "second sentinel")
  assert.equal(b.seen.filter(isNote(viaFrame.id)).length, 0, "a repeated add frame is not announced again")
  assert.equal(await stored(viaFrame.id), 1, "the same id added twice over the socket is stored once")

  // Bad frames are answered, never stored, and the socket stays open.
  const rejected = (f: Frame) => f.type === "rejected"
  a.send("not json")
  assert.ok((await a.next("rejected: bad JSON", rejected)).reason)
  const blank = `socket-check-${randomUUID()}`
  a.send({ type: "add", id: blank, text: "   " })
  await a.next("rejected: blank text", rejected)
  assert.equal(await stored(blank), 0, "a rejected add frame stores nothing")
  a.send({ type: "delete-everything" })
  await a.next("rejected: unknown type", rejected)
  a.ws.send(new Uint8Array([1, 2, 3]))
  await a.next("rejected: a binary frame", rejected)

  // Signalling: relayed to the named peer only, stamped with the sender's id by the server.
  a.send({ type: "signal", to: peerB, kind: "offer", sdp: "v=0 socket check" })
  const signal = await b.next("signal relayed to the second socket", (f) => f.type === "signal")
  assert.deepEqual([signal.from, signal.kind, signal.sdp], [peerA, "offer", "v=0 socket check"])
  a.send({ type: "signal", to: "nobody", kind: "offer", sdp: "v=0" })
  await a.next("rejected: a signal to a peer that is not here", rejected)
  a.send({ type: "signal", to: peerB, kind: "shout", sdp: "v=0" })
  await a.next("rejected: an unknown signal kind", rejected)

  // Leaving is announced to the rest.
  b.ws.close()
  await a.next("presence after a leave", (f) => f.type === "presence" && !f.peers!.includes(peerB))
  a.ws.close()
  console.log(`ok  socket: ${roomUrl} keeps the contract (welcome, presence, one note frame per stored note, idempotent add, rejected frames, relayed signals)`)
}
