/**
 * SCENE DATA: what the scene draws, as plain values. Pure, no DOM and no three.js, so the
 * view, the Commands and the Node tests all use it.
 *
 * One bar per note. Left to right is the order the notes were written. Height is the number
 * of characters. The lane says where the note lives: the front lane is stored on the
 * server, the back lane is not stored yet. The same list fills the HTML table, so the
 * picture and the table can't disagree.
 */
import { Option, Schema } from "effect"
import { AsyncData } from "foldkit"
import type { Model as NotesModel, Note } from "../model.ts"

export const BarState = Schema.Literals(["stored", "saved", "saving", "failed", "draft"])
export type BarState = typeof BarState.Type

export const Bar = Schema.Struct({ id: Schema.String, text: Schema.String, chars: Schema.Number, state: BarState })
export type Bar = typeof Bar.Type

export const Bars = Schema.Array(Bar)
export type Bars = typeof Bars.Type

/** What each state is called on screen: in the legend and in the table. */
export const STATE_LABEL: Record<BarState, string> = {
  stored: "Stored",
  saved: "Saved, waiting for the list",
  saving: "Saving",
  failed: "Not saved",
  draft: "Draft, not sent"
}

const chars = (text: string): number => [...text].length

/** Oldest first. Stored notes, then unsaved ones, then the draft being typed. */
export const barsOf = (model: NotesModel): Bars => {
  const loaded = Option.getOrElse(AsyncData.getData(model.notes), (): ReadonlyArray<Note> => [])
  const stored = loaded
    .filter((n) => !model.pending.some((p) => p.requestId === n.id))
    .map((n): Bar => ({ id: n.id, text: n.text, chars: chars(n.text), state: "stored" }))
  const pending = model.pending.map((p): Bar => ({
    id: p.requestId,
    text: p.text,
    chars: chars(p.text),
    state: p.phase._tag === "Saving" ? "saving" : p.phase._tag === "Saved" ? "saved" : "failed"
  }))
  const draft = model.draft.trim()
  // The API and the pending list are newest first; the scene reads oldest to newest.
  return [...stored.toReversed(), ...pending.toReversed(), ...(draft === "" ? [] : [{ id: "draft", text: draft, chars: chars(draft), state: "draft" } as const])]
}

export const sameBars = (a: Bars, b: Bars): boolean =>
  a.length === b.length && a.every((bar, i) => bar.id === b[i]!.id && bar.chars === b[i]!.chars && bar.state === b[i]!.state)

/** A round step (1, 2 or 5 times a power of ten) that gives at most five ticks up to `max`. */
export const tickStep = (max: number): number => {
  if (max <= 5) return 1
  const power = 10 ** Math.floor(Math.log10(max / 5))
  const scaled = max / 5 / power
  return (scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10) * power
}

/** World units. One slot is one unit wide; the tallest bar is BAR_MAX high. */
export const BAR_MAX = 3
export const BAR_WIDTH = 0.72
export const LANE_OFFSET = 0.7
const BAR_MIN = 0.04

export type Slot = Readonly<{ id: string; x: number; z: number; height: number; state: BarState }>
export type Layout = Readonly<{ slots: ReadonlyArray<Slot>; width: number; ticks: ReadonlyArray<number>; step: number; maxChars: number }>

/** Where each bar stands. The scene draws this and nothing else. */
export const layoutOf = (bars: Bars): Layout => {
  const maxChars = bars.reduce((max, bar) => Math.max(max, bar.chars), 0)
  const step = tickStep(maxChars)
  const unit = maxChars === 0 ? 0 : BAR_MAX / maxChars
  const width = Math.max(bars.length, 1)
  const slots = bars.map((bar, i): Slot => ({
    id: bar.id,
    x: i - (width - 1) / 2,
    z: bar.state === "stored" ? LANE_OFFSET : -LANE_OFFSET,
    height: Math.max(bar.chars * unit, BAR_MIN),
    state: bar.state
  }))
  const ticks: Array<number> = []
  for (let value = step; value <= maxChars; value += step) ticks.push(value * unit)
  return { slots, width, ticks, step, maxChars }
}

/** The canvas label: what the picture shows, in words. Text stays HTML, never canvas text. */
export const describe = (bars: Bars): string => {
  if (bars.length === 0) return "Chart of notes in the order they were written. No notes yet."
  const layout = layoutOf(bars)
  const count = bars.length === 1 ? "1 bar" : `${bars.length} bars`
  return `Chart of notes in the order they were written, oldest on the left. ${count}. Bar height is the number of characters, up to ${layout.maxChars}.`
}

export const scaleText = (bars: Bars): string => {
  const { step, maxChars } = layoutOf(bars)
  return maxChars === 0 ? "" : `Each tick on the scale is ${step} ${step === 1 ? "character" : "characters"}. The tallest bar is ${maxChars}.`
}

/**
 * The render gate. The scene draws only when every one of these holds. It is a pure
 * function so a Node test can pin it: off screen, a hidden tab, a paused Foldkit view or a
 * lost context each stop the loop on their own.
 */
export type Gate = Readonly<{ onScreen: boolean; tabVisible: boolean; live: boolean; contextLost: boolean }>
export const canRender = (gate: Gate): boolean => gate.onScreen && gate.tabVisible && gate.live && !gate.contextLost
