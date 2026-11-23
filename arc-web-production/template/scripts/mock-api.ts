/**
 * A stand-in API for local work: npm run mock  (127.0.0.1:8787, memory only). It mirrors
 * cloudflare/worker.ts; change both together, and run scripts/api-check.ts against each.
 * It keeps the one rule a real API must keep: POST is idempotent on the note's id, so a
 * retried save answers 200 and stores nothing new.
 *
 * Switches, to put the app in each state for step 8 ("Look at it"):
 *   DELAY_MS=1500        every reply waits, so Loading and Saving stay on screen
 *   FAIL_SAVES=1         every save answers 500: after its retries the row shows "not saved"
 *   FAIL_FIRST_SAVE=1    stores the first save, then drops its reply (a lost reply)
 *   stop the process     the status shows "Reconnecting…" and the last list stays (stale)
 *   PORT=8787            where it listens
 */
import { createServer } from "node:http"

const notes: Array<{ id: string; text: string }> = []
let dropNext = process.env.FAIL_FIRST_SAVE === "1"
const failSaves = process.env.FAIL_SAVES === "1"
const delay = Number(process.env.DELAY_MS ?? 0)

const server = createServer((req, res) => setTimeout(() => handle(req, res), delay))

function handle(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) {
  const json = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" })
    res.end(JSON.stringify(body))
  }
  if (req.url !== "/api/notes") return json(404, { error: "not found" })
  if (req.method === "GET") return json(200, notes)
  if (req.method !== "POST") return json(405, { error: "method not allowed" })
  if (failSaves) return json(500, { error: "FAIL_SAVES is set" })
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
}
server.listen(Number(process.env.PORT ?? 8787), "127.0.0.1", () => console.log("mock API on http://127.0.0.1:" + (process.env.PORT ?? 8787)))
