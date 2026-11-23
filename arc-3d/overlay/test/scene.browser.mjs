#!/usr/bin/env node
/**
 * The scene in a real browser. Node tests can't see a canvas, so this one drives Chromium
 * through playwright-core and reads pixels from screenshots.
 *
 *   npm run build
 *   PORT=8787 npm run mock &                                  the API
 *   API_URL=http://127.0.0.1:8787 npx vite preview --port 4173 &   the built app
 *   CHROME_PATH=/usr/bin/chromium node test/scene.browser.mjs http://127.0.0.1:4173
 *
 * It proves: the canvas draws, the colours on screen are the token values in both colour
 * schemes, adding a note changes the picture, controls work from the keyboard, the loop
 * stops off screen and in a hidden tab, a lost context has its screen and comes back,
 * hiding the chart disposes the renderer, the table stands in when WebGL is missing, the
 * pixel ratio is capped, and reduced motion draws one frame.
 *
 * It does not prove frame rate. Headless Chromium draws WebGL in software (SwiftShader),
 * so timing here says nothing about a real GPU. Use arc-webgl-performance for that.
 *
 * Start it on an API with no notes to also check the empty state.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { chromium } from "playwright-core"

const base = process.argv[2]
const executablePath = process.env.CHROME_PATH
if (!base || !executablePath) {
  console.error("usage: CHROME_PATH=<chromium> node test/scene.browser.mjs <app url>")
  process.exit(2)
}

// The expected colours come from the stylesheet on disk, not from the browser, so the
// comparison is independent of the code under test.
const css = readFileSync(new URL("../src/tokens.css", import.meta.url), "utf8")
const block = (from) => css.slice(from, css.indexOf("}", from))
const hex = (text, token) => {
  const value = new RegExp(`${token}:#([0-9a-fA-F]{3,6})\\b`).exec(text)?.[1]
  if (value === undefined) throw new Error(`${token} is not a hex colour in src/tokens.css`)
  const full = value.length === 3 ? [...value].map((c) => c + c).join("") : value
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
}
const NAMES = ["--bg", "--fg", "--dim", "--line", "--c1", "--c2", "--c3", "--c4"]
const tokensIn = (text) => Object.fromEntries(NAMES.map((name) => [name, hex(text, name)]))
const DARK = tokensIn(block(css.indexOf(":root{")))
const LIGHT = tokensIn(block(css.indexOf(":root:not(")))

let passed = 0
const ok = (label) => { passed += 1; console.log(`ok  ${label}`) }
const check = (condition, message) => { if (!condition) throw new Error(message) }

const browser = await chromium.launch({ executablePath, args: ["--force-color-profile=srgb"] })
// A blank page decodes screenshots, so pixel reading never touches the app's own page.
const reader = await (await browser.newContext()).newPage()

/** Count the canvas pixels that match each colour (within 2 per channel), and find the nearest pixel to each. */
let lastShot
const pixels = async (page, colours) => {
  const png = await page.locator("canvas").screenshot()
  lastShot = png
  return reader.evaluate(async ({ data, colours }) => {
    const image = new Image()
    image.src = `data:image/png;base64,${data}`
    await image.decode()
    const canvas = document.createElement("canvas")
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext("2d", { willReadFrequently: true })
    context.drawImage(image, 0, 0)
    const d = context.getImageData(0, 0, canvas.width, canvas.height).data
    const names = Object.keys(colours)
    const count = Object.fromEntries(names.map((n) => [n, 0]))
    const nearest = Object.fromEntries(names.map((n) => [n, Infinity]))
    for (let i = 0; i < d.length; i += 4) {
      for (const n of names) {
        const [r, g, b] = colours[n]
        const distance = Math.max(Math.abs(d[i] - r), Math.abs(d[i + 1] - g), Math.abs(d[i + 2] - b))
        if (distance <= 2) count[n] += 1
        if (distance < nearest[n]) nearest[n] = distance
      }
    }
    const at = (x, y) => [...d.slice((y * canvas.width + x) * 4, (y * canvas.width + x) * 4 + 3)]
    // A small copy of the picture, to compare two shots. Exact pixels are no use for that:
    // the canvas sits at a fractional offset, so edge pixels move with the scroll position.
    const small = document.createElement("canvas")
    small.width = 32
    small.height = 20
    const shrink = small.getContext("2d")
    shrink.imageSmoothingQuality = "high"
    shrink.drawImage(image, 0, 0, 32, 20)
    return { count, nearest, sketch: [...shrink.getImageData(0, 0, 32, 20).data], corner: at(3, 3), total: d.length / 4 }
  }, { data: png.toString("base64"), colours })
}
const same = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 2)
/** Mean difference between two sketches, 0 to 255. The same picture measures under 0.01; a turned view about 7. */
const apart = (a, b) => a.sketch.reduce((sum, v, i) => sum + Math.abs(v - b.sketch[i]), 0) / a.sketch.length
const alike = (a, b) => apart(a, b) < 0.5
const changed = (a, b) => apart(a, b) > 2
const spread = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])))
const state = (page) => page.locator("canvas").getAttribute("data-scene-state")
const frames = async (page) => Number(await page.locator("canvas").getAttribute("data-scene-frames"))
const idle = (page) => page.waitForSelector('canvas[data-scene-state="idle"]', { timeout: 15000 })
const settle = (page) => page.waitForTimeout(350)
const until = async (label, probe, timeout = 12000) => {
  const end = Date.now() + timeout
  for (;;) {
    const value = await probe()
    if (value) return value
    if (Date.now() > end) throw new Error(`timed out: ${label}`)
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}
/** Filled faces match exactly. Lines are one pixel wide and antialiased, so ask only for a pixel nearer the token than the background. */
const expectColours = async (page, tokens, label) => {
  const seen = await pixels(page, tokens)
  check(same(seen.corner, tokens["--bg"]), `${label}: the canvas corner is ${seen.corner}, --bg is ${tokens["--bg"]}`)
  check(seen.count["--bg"] > seen.total / 2, `${label}: --bg fills less than half the canvas`)
  check(seen.count["--c1"] > 100, `${label}: only ${seen.count["--c1"]} pixels are --c1 ${tokens["--c1"]}`)
  for (const line of ["--fg", "--dim", "--line"]) {
    const gap = spread(tokens[line], tokens["--bg"])
    check(seen.nearest[line] < gap / 2, `${label}: no pixel is near ${line} ${tokens[line]} (nearest is ${seen.nearest[line]} away, background is ${gap} away)`)
  }
  return seen
}

const errors = []
const open = async (options, init) => {
  const context = await browser.newContext(options)
  if (init) await context.addInitScript(init)
  const page = await context.newPage()
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto(base)
  return page
}
const api = (path, body) => fetch(base + path, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })

try {
  // EMPTY ---------------------------------------------------------------------
  if ((await (await api("/api/notes")).json()).length === 0) {
    const page = await open({ viewport: { width: 1000, height: 900 }, colorScheme: "dark" })
    await idle(page)
    check(await page.getByText("Nothing to draw yet. Add the first note above.").isVisible(), "the empty screen is not showing")
    check((await page.locator("canvas").getAttribute("aria-label")).endsWith("No notes yet."), "the empty canvas label is wrong")
    await page.context().close()
    ok("empty: with no notes the stage says how to add the first one")
  } else console.log("SKIP empty state: the API already has notes")

  for (const [id, text] of [["seed-1", "first note"], ["seed-2", "a much longer second note, so the chart has one tall bar"], ["seed-3", "third"]]) await api("/api/notes", { id, text })
  const seeded = (await (await api("/api/notes")).json()).length

  // DRAWS, IN TOKEN COLOURS -----------------------------------------------------
  const page = await open({ viewport: { width: 1000, height: 900 }, colorScheme: "dark" })
  await idle(page)
  await until("the seeded notes are drawn", async () => (await page.locator("canvas").getAttribute("aria-label")).includes(`${seeded} bars`))
  await settle(page)
  const baseline = await expectColours(page, DARK, "dark")
  check(baseline.total - baseline.count["--bg"] > 1000, "fewer than 1000 pixels are not the background")
  ok(`draws: the canvas has ${baseline.total - baseline.count["--bg"]} pixels that are not the background`)
  ok("dark colours: the corner is --bg, bar tops are --c1 exactly, lines are near --fg, --dim and --line")

  // ACCESSIBLE ------------------------------------------------------------------
  check(await page.getByRole("img", { name: /Chart of notes in the order they were written/ }).count() === 1, "the canvas is not one labelled image")
  check(await page.locator("canvas").evaluate((c) => c.textContent === ""), "the canvas holds text")
  await page.getByText("The same notes as a table").click()
  check(await page.getByRole("row").count() === seeded + 1, "the table does not have one row per bar")
  for (const name of ["Turn left", "Turn right", "Reset view", "Hide chart"]) check(await page.getByRole("button", { name, exact: true }).count() === 1, `no button labelled ${name}`)
  ok("accessible: the canvas is one labelled image, the same notes are a table, every control is a labelled button")

  // ADDING A NOTE CHANGES THE PICTURE ---------------------------------------------
  // Hold the save, then fail it, so each state stays on screen long enough to read.
  let release = () => {}
  let failing = true
  await page.route("**/api/notes", async (route) => {
    if (route.request().method() !== "POST") return route.continue()
    if (!failing) return route.continue()
    await new Promise((resolve) => { release = resolve })
    await route.abort()
  })
  const before = await frames(page)
  await page.getByRole("textbox", { name: "Note", exact: true }).fill("a note typed by the browser test")
  await until("the draft is drawn", async () => changed(await pixels(page, DARK), baseline))
  ok("draft: typing draws the draft outline before anything is sent")
  await page.getByRole("button", { name: "Add", exact: true }).click()
  await until("the saving bar is --c2", async () => (await pixels(page, DARK)).count["--c2"] > 50)
  // Every retry of the save is aborted too, so the note ends as not saved.
  const releasing = setInterval(() => release(), 50)
  await until("the failed bar is --c4", async () => (await pixels(page, DARK)).count["--c4"] > 50)
  clearInterval(releasing)
  failing = false
  await page.getByRole("button", { name: /^Retry/ }).click()
  await until("the saved bar is --c3", async () => (await pixels(page, DARK)).count["--c3"] > 50)
  await until("the stored bar is --c1", async () => { const seen = await pixels(page, DARK); return seen.count["--c3"] === 0 && seen.count["--c1"] > baseline.count["--c1"] })
  check((await page.locator("canvas").getAttribute("aria-label")).includes(`${seeded + 1} bars`), "the canvas label did not follow the new note")
  check(await page.getByRole("row").count() === seeded + 2, "the table did not follow the new note")
  check((await frames(page)) > before, "no frame was drawn for the new note")
  await page.unroute("**/api/notes")
  ok("adding a note changes the picture: saving is --c2, not saved is --c4, saved is --c3, stored is --c1")

  // KEYBOARD ----------------------------------------------------------------------
  await idle(page)
  await settle(page)
  const front = await pixels(page, DARK)
  const beforeTurn = await frames(page)
  await page.getByRole("button", { name: "Turn right", exact: true }).focus()
  await page.keyboard.press("Enter")
  await until("the turn ran", async () => (await frames(page)) > beforeTurn)
  await idle(page)
  const turnFrames = (await frames(page)) - beforeTurn
  check(turnFrames > 1, `a turn drew ${turnFrames} frame, so it did not animate`)
  check(changed(await pixels(page, DARK), front), "Turn right did not change the picture")
  await page.getByRole("button", { name: "Reset view", exact: true }).focus()
  await page.keyboard.press("Space")
  await until("the reset ran", async () => alike(await pixels(page, DARK), front))
  ok(`keyboard: Enter on Turn right animates the view (${turnFrames} frames), Space on Reset view brings the same picture back`)

  // COLOUR SCHEME -------------------------------------------------------------------
  await page.emulateMedia({ colorScheme: "light" })
  await until("the scene repaints light", async () => same((await pixels(page, LIGHT)).corner, LIGHT["--bg"]))
  const light = await expectColours(page, LIGHT, "light")
  const stale = await pixels(page, { c1: DARK["--c1"], bg: DARK["--bg"] })
  check(stale.count.c1 === 0 && stale.count.bg === 0, "dark colours are still on screen in the light scheme")
  ok(`light colours: the scene re-read the tokens (${light.count["--c1"]} pixels are the light --c1, none are the dark one)`)
  await page.evaluate(() => { document.documentElement.dataset.theme = "dark" })
  await until("data-theme forces dark", async () => same((await pixels(page, DARK)).corner, DARK["--bg"]))
  await page.evaluate(() => { delete document.documentElement.dataset.theme })
  await page.emulateMedia({ colorScheme: "dark" })
  await until("the scene repaints dark", async () => alike(await pixels(page, DARK), front))
  ok("forced theme: data-theme=\"dark\" on <html> repaints the scene dark while the system is light")

  // RESIZE --------------------------------------------------------------------------
  await page.setViewportSize({ width: 620, height: 900 })
  await until("the buffer follows the element", () => page.locator("canvas").evaluate((c) => c.clientWidth < 620 && c.width === c.clientWidth && c.height === c.clientHeight))
  await expectColours(page, DARK, "after a resize")
  ok("resize: the drawing buffer follows the element and the picture is redrawn")

  // THE LOOP STOPS --------------------------------------------------------------------
  await page.setViewportSize({ width: 620, height: 260 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await until("off screen stops the loop", async () => (await state(page)) === "stopped")
  const parked = await frames(page)
  await page.getByRole("textbox", { name: "Note", exact: true }).fill("typed while the chart is off screen")
  await settle(page)
  check((await frames(page)) === parked, "frames were drawn while the canvas was off screen")
  await page.locator("canvas").scrollIntoViewIfNeeded()
  await until("back on screen draws again", async () => (await state(page)) === "idle" && (await frames(page)) > parked)
  await page.getByRole("textbox", { name: "Note", exact: true }).fill("")
  await page.setViewportSize({ width: 1000, height: 900 })
  await idle(page)
  ok("off screen: no frame is drawn while the canvas is out of view, and it catches up when it returns")

  const hide = (hidden) => page.evaluate((hidden) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (hidden ? "hidden" : "visible") })
    document.dispatchEvent(new Event("visibilitychange"))
  }, hidden)
  await hide(true)
  await until("a hidden tab stops the loop", async () => (await state(page)) === "stopped")
  const asleep = await frames(page)
  await page.getByRole("button", { name: "Turn right", exact: true }).click()
  await settle(page)
  check((await frames(page)) === asleep, "frames were drawn while the tab was hidden")
  await hide(false)
  await until("a visible tab draws again", async () => (await state(page)) === "idle" && (await frames(page)) > asleep)
  await page.getByRole("button", { name: "Reset view", exact: true }).click()
  await idle(page)
  ok("hidden tab: no frame is drawn while the document is hidden (visibilityState is overridden in the test page)")

  // CONTEXT LOST AND RESTORED -----------------------------------------------------------
  await page.locator("canvas").evaluate((c) => { window.__lose = c.getContext("webgl2").getExtension("WEBGL_lose_context"); window.__lose.loseContext() })
  await page.getByText("The chart stopped drawing. It restarts by itself.").waitFor()
  check((await state(page)) === "lost", "the scene does not report the lost context")
  check(await page.getByRole("button", { name: "Turn right", exact: true }).isDisabled(), "controls stay enabled while the context is lost")
  await page.evaluate(() => window.__lose.restoreContext())
  await page.getByText("The chart stopped drawing. It restarts by itself.").waitFor({ state: "detached" })
  await until("the restored scene draws", async () => (await pixels(page, DARK)).count["--c1"] > 100)
  await expectColours(page, DARK, "after a restored context")
  ok("context lost: the stage says so and the controls are off; after restoreContext the same picture is drawn again")

  // LEAVING THE VIEW DISPOSES THE RENDERER ----------------------------------------------
  await page.evaluate(() => { window.__old = document.querySelector("canvas") })
  await page.getByRole("button", { name: "Hide chart", exact: true }).click()
  const gone = await until("the old canvas is disposed", () => page.evaluate(() => {
    const c = window.__old
    return c.dataset.sceneState === "disposed" && { connected: c.isConnected, geometries: c.dataset.sceneGeometries, lost: c.getContext("webgl2").isContextLost(), canvases: document.querySelectorAll("canvas").length }
  }))
  check(!gone.connected && gone.canvases === 0, "the canvas is still in the page")
  check(gone.geometries === "0", `three.js still holds ${gone.geometries} geometries after dispose`)
  check(gone.lost, "the WebGL context was not given back")
  await page.getByRole("button", { name: "Show chart", exact: true }).click()
  await idle(page)
  check(await page.evaluate(() => document.querySelector("canvas") !== window.__old), "the same canvas came back")
  await until("the new scene draws", async () => (await pixels(page, DARK)).count["--c1"] > 100)
  ok("dispose: hiding the chart removes the canvas, frees every geometry and loses the context; showing it builds a new scene")
  await page.context().close()

  // PHONE WIDTH AND THE PIXEL RATIO CAP ---------------------------------------------------
  const phone = await open({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, colorScheme: "light" })
  await idle(phone)
  const fit = await phone.evaluate(() => { const c = document.querySelector("canvas"); return { scroll: document.documentElement.scrollWidth, ratio: c.width / c.clientWidth, dpr: window.devicePixelRatio } })
  check(fit.scroll <= 390, `the page scrolls sideways at 390 px (${fit.scroll})`)
  check(fit.dpr === 3 && Math.abs(fit.ratio - 2) < 0.01, `the buffer is ${fit.ratio} times the element on a 3x screen; the cap is 2`)
  await phone.context().close()
  ok("phone: no sideways scroll at 390 px, and a 3x screen gets a 2x drawing buffer")

  // REDUCED MOTION ------------------------------------------------------------------------
  const calm = await open({ viewport: { width: 1000, height: 900 }, colorScheme: "dark", reducedMotion: "reduce" })
  await idle(calm)
  await until("the notes are drawn", async () => (await calm.locator("canvas").getAttribute("aria-label")).includes(`${seeded + 1} bars`))
  await settle(calm)
  // A fresh Mount with the notes already loaded: the whole entrance is one frame.
  await calm.getByRole("button", { name: "Hide chart", exact: true }).click()
  await calm.getByRole("button", { name: "Show chart", exact: true }).click()
  await idle(calm)
  await settle(calm)
  check((await frames(calm)) === 1, `the entrance drew ${await frames(calm)} frames under reduced motion`)
  await calm.getByRole("button", { name: "Turn right", exact: true }).click()
  await until("the turn is drawn", async () => (await frames(calm)) > 1)
  await settle(calm)
  check((await frames(calm)) === 2, `a turn drew ${(await frames(calm)) - 1} frames under reduced motion`)
  await expectColours(calm, DARK, "reduced motion")
  await calm.context().close()
  ok("reduced motion: the entrance is one frame and a turn is one frame")

  // NO WEBGL --------------------------------------------------------------------------------
  // `--disable-gpu` leaves software WebGL on, so it does not force this. Making getContext
  // answer null does, in any Chromium.
  const requests = []
  const bare = await browser.newContext({ viewport: { width: 1000, height: 900 }, colorScheme: "dark" })
  await bare.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null })
  const plain = await bare.newPage()
  plain.on("request", (request) => requests.push(request.url()))
  plain.on("pageerror", (error) => errors.push(error.message))
  await plain.goto(base)
  await plain.getByText("This browser can't draw the 3D chart. The same notes are in the table below.").waitFor()
  await until("the table has the notes", async () => (await plain.getByRole("row").count()) === seeded + 2)
  check(await plain.getByRole("table").isVisible(), "the fallback table is not visible")
  check(await plain.locator("canvas").count() === 0, "a canvas is in the page without WebGL")
  check(await plain.getByRole("cell", { name: "a note typed by the browser test" }).count() === 1, "the fallback table misses a note")
  check(!requests.some((url) => /\/assets\/scene-/.test(url)), "three.js was downloaded although WebGL is missing")
  await bare.close()
  ok("no WebGL: the same notes show as a table, there is no canvas, and three.js is never downloaded")

  // The same screen with no test hook: a browser started without any WebGL. These two flags
  // did that in Chromium 152. If a build still hands out a context, say so and move on.
  const dry = await chromium.launch({ executablePath, args: ["--disable-gpu", "--disable-software-rasterizer"] })
  try {
    const real = await dry.newPage()
    real.on("pageerror", (error) => errors.push(error.message))
    await real.goto(base)
    if (await real.evaluate(() => document.createElement("canvas").getContext("webgl2") !== null)) {
      console.log("SKIP no WebGL by browser flags: this build still gives a WebGL 2 context")
    } else {
      await real.getByText("This browser can't draw the 3D chart. The same notes are in the table below.").waitFor()
      check(await real.locator("canvas").count() === 0 && await real.getByRole("table").isVisible(), "the fallback is not showing in a browser without WebGL")
      ok("no WebGL by browser flags: --disable-gpu with --disable-software-rasterizer shows the table too")
    }
  } finally {
    await dry.close()
  }

  check(errors.length === 0, `page errors: ${errors.join(" | ")}`)
  ok("no page errors in any run")
  console.log(`--- ${passed} browser checks passed. Frame rate: NOT_RUN (software WebGL).`)
} catch (error) {
  console.error(`FAIL ${error.message}`)
  // SHOT=<file.png> keeps the last canvas screenshot, to look at what was on screen.
  if (process.env.SHOT && lastShot) { writeFileSync(process.env.SHOT, lastShot); console.error(`last canvas screenshot: ${process.env.SHOT}`) }
  process.exitCode = 1
} finally {
  await browser.close()
}
