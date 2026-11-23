/**
 * The lowest rung: the same kind of pure view, rendered once in Node to a page with no
 * JavaScript. Run: node scripts/render-static.ts [notes.json]  ->  dist/static.html
 *
 * `isHydratable: false` leaves out hydration stamps and the Flags script, so the output
 * meets the Postplan contract (no script, one inline <style>). Nothing on a static page is
 * clickable, so its Message type is `never` and it has no form: the app's own `view` has
 * one, which is why this is a separate view over the same Schemas.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { Effect, Schema } from "effect"
import { Server } from "foldkit/experimental"
import type { Document, HtmlBuilder } from "foldkit/html"
import { Notes } from "../src/model.ts"

const Flags = Schema.Struct({ title: Schema.String, notes: Notes })
type Flags = typeof Flags.Type

const view = (model: Flags, h: HtmlBuilder<never>): Document => ({
  title: model.title,
  body: h.main([h.Class("app")], [
    h.h1([], [model.title]),
    model.notes.length === 0
      ? h.p([h.Class("dim")], ["No notes."])
      : h.ul([h.Class("items")], model.notes.map((n) => h.li([h.Class("item")], [h.span([h.Class("text")], [n.text])])))
  ])
})

const root = join(import.meta.dirname, "..")
const escapeText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const css = ["src/tokens.css", "src/styles.css"].map((f) => readFileSync(join(root, f), "utf8")).join("\n")

const input = process.argv[2]
const notes = Schema.decodeUnknownSync(Notes)(input ? JSON.parse(readFileSync(input, "utf8")) : [{ id: "n1", text: "A sample note" }])
const flags: Flags = { title: "Notes", notes }

const rendered = await Effect.runPromise(Server.renderToString({ Flags, init: (f: Flags) => ({ model: f }), view }, { flags, isHydratable: false }))
const html = [
  "<!doctype html>",
  `<html lang="en">`,
  "<head>",
  `<meta charset="utf-8">`,
  `<meta name="viewport" content="width=device-width, initial-scale=1">`,
  `<meta name="color-scheme" content="dark light">`,
  `<title>${escapeText(rendered.title)}</title>`,
  `<style>${css}</style>`,
  "</head>",
  `<body>${rendered.html}</body>`,
  "</html>",
  ""
].join("\n")
if (/<script/i.test(html)) throw new Error("the static page contains a script")
mkdirSync(join(root, "dist"), { recursive: true })
writeFileSync(join(root, "dist", "static.html"), html)
console.log(`wrote dist/static.html (${html.length} bytes, no script)`)
