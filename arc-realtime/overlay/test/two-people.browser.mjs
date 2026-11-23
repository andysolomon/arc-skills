/**
 * arc-realtime: the two-person check, in a real browser. Not part of `npm test`: it needs a
 * running app, a Chromium and the playwright-core package.
 *
 *   npm install --save-exact --save-dev playwright-core@1.65.1
 *   CHROME_PATH=/usr/bin/chromium node test/two-people.browser.mjs http://127.0.0.1:5173
 *
 * Point it at `npm run dev` (with `npm run mock`) or at `npm run cf:dev`. Two browser
 * contexts are two people: they share no cookies, storage or sockets. It adds two notes, so
 * run it on local or test data only.
 */
import assert from "node:assert/strict"
import { chromium } from "playwright-core"

const base = process.argv[2] ?? "http://127.0.0.1:5173"
const executablePath = process.env.CHROME_PATH
assert.ok(executablePath, "set CHROME_PATH to a Chromium or Chrome binary")

const browser = await chromium.launch({ executablePath })
const person = async (viewport) => {
  const context = await browser.newContext({ viewport })
  // Keep a handle on every room socket the page opens, so the test can drop one the way a network would.
  await context.addInitScript(() => {
    const sockets = (window.__roomSockets = [])
    window.WebSocket = class extends WebSocket {
      constructor(...args) {
        super(...args)
        if (String(args[0]).endsWith("/api/room")) sockets.push(this)
      }
    }
  })
  const page = await context.newPage()
  await page.goto(base)
  return { context, page }
}
const status = (page, text) => page.getByRole("status").filter({ hasText: text }).waitFor()
/** Adds a note and waits for the server's 200. The "saved" badge is not waited on: the next list load removes it. */
const add = async (page, text) => {
  await page.getByRole("textbox", { name: "Note" }).fill(text)
  const stored = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/notes" && response.request().method() === "POST" && response.status() === 200)
  await page.getByRole("button", { name: "Add" }).click()
  await stored
}

try {
  const a = await person({ width: 1280, height: 800 })
  const b = await person({ width: 390, height: 844 })
  await Promise.all([status(a.page, "Live"), status(b.page, "Live")])
  await Promise.all([a.page.getByText("2 people are here.").waitFor(), b.page.getByText("2 people are here.").waitFor()])
  console.log("ok  browser: both people are live, and each sees 2 people here")

  // A note added by one person shows for the other with no reload and no list request.
  let listLoads = 0
  b.page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/notes") listLoads++
  })
  const first = `first note ${Date.now()}`
  await add(a.page, first)
  await b.page.getByText(first).waitFor({ timeout: 3000 })
  assert.equal(listLoads, 0, "the note reached the second person over the socket, not through a list load")
  console.log("ok  browser: a note added by one person appears for the other, delivered by the socket")

  const sideways = await b.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  assert.ok(sideways <= 0, `no sideways scroll at 390 px (overflow ${sideways}px)`)
  console.log("ok  browser: no sideways scroll at 390 px")

  // WebRTC: the handshake goes through the room socket, then one message goes browser to browser.
  await a.page.getByRole("button", { name: "Connect directly" }).click()
  await Promise.all([a.page.getByText("Direct link open.").waitFor(), b.page.getByText("Direct link open.").waitFor()])
  await a.page.getByRole("button", { name: "Wave" }).click()
  await b.page.getByText("Waves sent 0, received 1.").waitFor()
  await a.page.getByText("Waves sent 1, received 0.").waitFor()
  console.log("ok  browser: a data channel opened between the two pages and carried one message")

  // The second person's network goes away: the socket drops, the last notes stay on screen.
  await b.context.setOffline(true)
  await b.page.evaluate(() => window.__roomSockets.forEach((socket) => socket.close()))
  await status(b.page, "Reconnecting…")
  await b.page.getByText(first).waitFor()
  // A note is stored while they are away. A write is HTTP, so it never depended on a socket.
  const second = `second note ${Date.now()}`
  await add(a.page, second)
  assert.equal(await b.page.getByText(second).count(), 0, "the second person has not seen the note yet")
  // Back online: the backoff dials again, the welcome frame starts a list load, the note is there.
  await b.context.setOffline(false)
  await status(b.page, "Live")
  await b.page.getByText(second).waitFor({ timeout: 3000 })
  await b.page.getByText("2 people are here.").waitFor()
  console.log("ok  browser: after a drop the status says Reconnecting, the list stays, and the reconnect catches up")

  // Leaving is seen by the other person.
  await a.context.close()
  await b.page.getByText("Only you are here.").waitFor()
  console.log("ok  browser: when one person leaves, the other sees the count drop")
} finally {
  await browser.close()
}
