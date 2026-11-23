/**
 * A stand-in API for local work: node scripts/mock-api.ts  (127.0.0.1:8787, memory only).
 * It shows the one rule a real API must keep: POST is idempotent on the note's id, so a
 * retried save answers 200 and stores nothing new. FAIL_FIRST_SAVE=1 drops the first reply
 * after storing the note, to exercise the client's retry.
 */
import { createServer } from "node:http"

const notes: Array<{ id: string; text: string }> = []
let dropNext = process.env.FAIL_FIRST_SAVE === "1"

const server = createServer((req, res) => {
  const json = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" })
    res.end(JSON.stringify(body))
  }
  if (req.url !== "/api/notes") return json(404, { error: "not found" })
  if (req.method === "GET") return json(200, notes)
  if (req.method !== "POST") return json(405, { error: "method not allowed" })
  let raw = ""
  req.on("data", (chunk) => (raw += chunk))
  req.on("end", () => {
    let body: { id?: unknown; text?: unknown }
    try { body = JSON.parse(raw) } catch { return json(400, { error: "invalid JSON" }) }
    if (typeof body.id !== "string" || typeof body.text !== "string" || body.text.trim() === "") return json(400, { error: "id and text are required" })
    if (!notes.some((n) => n.id === body.id)) notes.unshift({ id: body.id, text: body.text })
    if (dropNext) { dropNext = false; return res.destroy() } // stored, but the reply is lost
    json(200, { id: body.id })
  })
})
server.listen(Number(process.env.PORT ?? 8787), "127.0.0.1", () => console.log("mock API on http://127.0.0.1:" + (process.env.PORT ?? 8787)))
