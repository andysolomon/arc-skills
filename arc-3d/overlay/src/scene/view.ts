/**
 * THE SCENE'S VIEW. Pure, like every Foldkit view: it places the canvas and the Mount, and
 * everything a person reads is HTML around it.
 *
 * Every state has a screen: hidden, loading, WebGL not available (the table stands in),
 * context lost, notes still loading, notes failed, no notes yet, and stale. The canvas is
 * one picture to a screen reader (`role="img"` with a label that says what it shows), and
 * the same rows are in the table below it.
 */
import { AsyncData } from "foldkit"
import type { Html, HtmlBuilder } from "foldkit/html"
import type { Message, Model } from "../app.ts"
import { type Bars, type BarState, barsOf, describe, scaleText, STATE_LABEL } from "./data.ts"
import { SCENE_ID } from "./handle.ts"
import { SceneMessage, SceneStatus } from "./model.ts"
import { HostScene } from "./mount.ts"

const LEGEND: ReadonlyArray<BarState> = ["stored", "saving", "saved", "failed", "draft"]

/** The sentence over the canvas when there is no picture to look at, or none yet. */
const stageNote = (model: Model, bars: Bars): string | undefined =>
  SceneStatus.match(model.scene.status, {
    Loading: () => "Loading the chart…",
    Lost: () => "The chart stopped drawing. It restarts by itself. The table below has the same notes.",
    Unavailable: () => undefined,
    Ready: () =>
      bars.length > 0
        ? undefined
        : AsyncData.matchData(model.notes, {
            onEmpty: () => "Loading notes…",
            onFailure: () => "Couldn't load notes, so there is nothing to draw. Retrying every few seconds.",
            onData: () => "Nothing to draw yet. Add the first note above."
          })
  })

const dataTable = (bars: Bars, h: HtmlBuilder<Message>): Html =>
  bars.length === 0
    ? h.p([h.Class("dim")], ["No notes yet. Add the first one above."])
    : h.table([h.Class("scene-table")], [
        h.caption([], ["Notes in the order they were written, oldest first"]),
        h.thead([], [h.tr([], [h.th([h.Scope("col")], ["Order"]), h.th([h.Scope("col")], ["Note"]), h.th([h.Scope("col")], ["Characters"]), h.th([h.Scope("col")], ["State"])])]),
        h.tbody([], bars.map((bar, i) =>
          h.keyed("tr")(bar.id, [], [
            h.td([h.Class("num")], [String(i + 1)]),
            h.td([h.Class("text")], [bar.text]),
            h.td([h.Class("num")], [String(bar.chars)]),
            h.td([], [STATE_LABEL[bar.state]])
          ])
        ))
      ])

const controls = (model: Model, h: HtmlBuilder<Message>): Html => {
  const idle = model.scene.status._tag !== "Ready"
  return h.div([h.Class("scene-controls"), h.Role("group"), h.AriaLabel("Chart view")], [
    h.button([h.Type("button"), h.Disabled(idle), h.OnClick(SceneMessage.ClickedTurnScene({ by: -1 }))], ["Turn left"]),
    h.button([h.Type("button"), h.Disabled(idle), h.OnClick(SceneMessage.ClickedTurnScene({ by: 1 }))], ["Turn right"]),
    h.button([h.Type("button"), h.Disabled(idle || model.scene.turns === 0), h.OnClick(SceneMessage.ClickedResetScene())], ["Reset view"])
  ])
}

const legend = (bars: Bars, h: HtmlBuilder<Message>): Html =>
  h.div([h.Class("scene-key")], [
    h.ul([h.Class("legend"), h.AriaLabel("Bar colours")], LEGEND.map((state) =>
      h.li([], [h.span([h.Class(`swatch is-${state}`), h.AriaHidden(true)], []), STATE_LABEL[state]])
    )),
    h.p([h.Class("dim")], [`Left to right is oldest to newest. The front lane is stored, the back lane is not stored yet. ${scaleText(bars)}`.trim()])
  ])

export const sceneView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const bars = barsOf(model)
  const note = stageNote(model, bars)
  const stale = model.notes._tag === "Stale" && model.scene.status._tag === "Ready"
  return h.section([h.Class("scene"), h.AriaLabel("Notes chart")], [
    h.div([h.Class("scene-top")], [
      h.h2([], ["Notes by write order"]),
      h.button([h.Type("button"), h.AriaExpanded(model.scene.isShown), h.OnClick(SceneMessage.ClickedToggleScene())], [model.scene.isShown ? "Hide chart" : "Show chart"])
    ]),
    ...(!model.scene.isShown
      ? []
      : model.scene.status._tag === "Unavailable"
        ? [
            // The technical reason stays in the Model for tests and DevTools.
            h.p([h.Class("scene-fallback"), h.Role("status"), h.AriaLabel("Chart status")], ["This browser can't draw the 3D chart. The same notes are in the table below."]),
            dataTable(bars, h)
          ]
        : [
            h.div([h.Class("stage")], [
              // Keyed, so the canvas keeps its DOM node, and with it the Mount, across renders.
              h.keyed("canvas")(SCENE_ID, [
                h.Id(SCENE_ID),
                h.Role("img"),
                h.AriaLabel(describe(bars)),
                h.OnMount(HostScene({ initialBars: bars, initialTurns: model.scene.turns }))
              ], []),
              note === undefined ? h.empty : h.p([h.Class("stage-note"), h.Role("status"), h.AriaLabel("Chart status")], [note])
            ]),
            stale ? h.p([h.Class("dim")], ["Showing the last notes that loaded."]) : h.empty,
            controls(model, h),
            legend(bars, h),
            h.details([h.Class("scene-data")], [h.summary([], ["The same notes as a table"]), dataTable(bars, h)])
          ])
  ])
}
