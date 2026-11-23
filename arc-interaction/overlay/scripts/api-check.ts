/**
 * Checks an API against the contract the app relies on. Run it against the mock and the
 * real Worker after any API change:
 *
 *   node scripts/api-check.ts http://127.0.0.1:8787
 *
 * Writes one note with a random id (twice) and removes it, so run it on local or test data only.
 */
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

const base = process.argv[2] ?? "http://127.0.0.1:8787"
const url = `${base}/api/notes`
const post = (body: string) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body })
const id = `api-check-${randomUUID()}`
const count = async () => ((await (await fetch(url)).json()) as Array<{ id: string }>).filter((n) => n.id === id).length

assert.equal((await fetch(url)).status, 200, "GET answers 200")
assert.equal((await post(JSON.stringify({ id, text: "api check" }))).status, 200, "a save answers 200")
assert.equal((await post(JSON.stringify({ id, text: "api check" }))).status, 200, "the same save again answers 200")
assert.equal(await count(), 1, "the same id saved twice is stored once")
assert.equal((await post(JSON.stringify({ id: randomUUID(), text: "  " }))).status, 400, "blank text answers 400")
assert.equal((await post(JSON.stringify({ id: "x".repeat(65), text: "a note" }))).status, 400, "an id past 64 characters answers 400")
assert.equal((await post(JSON.stringify({ id: randomUUID(), text: "x".repeat(2001) }))).status, 400, "text past 2,000 characters answers 400")
assert.equal((await post("not json")).status, 400, "bad JSON answers 400")
assert.equal((await fetch(url, { method: "DELETE" })).status, 405, "an unknown method answers 405")
// arc-interaction: a removal is idempotent on the note's id.
const remove = () => fetch(`${url}/${encodeURIComponent(id)}`, { method: "DELETE" })
assert.equal((await remove()).status, 200, "a removal answers 200")
assert.equal(await count(), 0, "the removed note is gone")
assert.equal((await remove()).status, 200, "the same removal again answers 200")
assert.equal((await fetch(`${url}/${encodeURIComponent(id)}`, { method: "PUT" })).status, 405, "an unknown method on a note answers 405")
console.log(`ok  api: ${base} keeps the contract (idempotent save and removal, 400 on bad input, 405)`)
