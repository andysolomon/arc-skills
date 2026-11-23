/**
 * The notes app with a scene. This file wraps the template's program (main.ts) and leaves
 * it untouched: the Model gains a `scene` field, `update` runs the notes update and then
 * asks whether the picture changed, and `view` puts the scene under the notes.
 *
 * In an app of your own, do the same three things in your own main.ts: add the `scene`
 * field to your Model, end `update` with `redraw`, and call `sceneView` from `view`.
 *
 *   scene/model.ts     the scene's Model and Messages
 *   scene/data.ts      what the scene draws, as plain values (pure)
 *   scene/tokens.ts    design tokens to scene colours and timings
 *   scene/mount.ts     the Mount: builds and disposes the renderer
 *   scene/commands.ts  Model changes on their way to the running scene
 *   scene/scene.ts     three.js (loaded on demand)
 *   scene/view.ts      canvas, controls, legend, table, every state's screen
 */
import { Schema } from "effect"
import type { HttpClient } from "effect/http"
import { Submodel, type Update } from "foldkit"
import type { Document, HtmlBuilder } from "foldkit/html"
import { emptyModel, init as notesInit, subscriptions as notesSubscriptions, update as notesUpdate, view as notesView } from "./main.ts"
import { type Message as NotesMessage, Model as NotesSchema, type Model as NotesModel } from "./model.ts"
import { DrawBars, TurnScene } from "./scene/commands.ts"
import { barsOf, sameBars } from "./scene/data.ts"
import { initialScene, SceneMessage, SceneModel, SceneStatus } from "./scene/model.ts"
import { sceneView } from "./scene/view.ts"

export const Model = Schema.Struct({ ...NotesSchema.fields, scene: SceneModel })
export type Model = typeof Model.Type

export type Message = NotesMessage | SceneMessage

type Return = Update.Return<Model, Message, HttpClient.HttpClient>

const isSceneMessage = Schema.is(SceneMessage)
const isDrawing = (model: Model): boolean => model.scene.isShown && model.scene.status._tag === "Ready"
const withScene = (model: Model, f: (scene: SceneModel) => SceneModel): Model => ({ ...model, scene: f(model.scene) })

// UPDATE ---------------------------------------------------------------------

/**
 * Model changes reach the scene here. After any Message, if the bars the scene should show
 * are different from before and a scene is running, send them with a Command. Pure: it
 * compares two Models and returns a value.
 */
export const redraw = (before: Model, next: Return): Return => {
  const bars = barsOf(next.model)
  if (!isDrawing(next.model) || sameBars(barsOf(before), bars)) return next
  return { model: next.model, commands: [...(next.commands ?? []), DrawBars({ bars })] }
}

const updateScene = (model: Model, message: SceneMessage): Return =>
  SceneMessage.match<Return>(message, {
    ClickedTurnScene: ({ by }) => {
      if (!isDrawing(model)) return { model }
      const turns = model.scene.turns + by
      return { model: withScene(model, (scene) => ({ ...scene, turns })), commands: [TurnScene({ turns })] }
    },

    ClickedResetScene: () =>
      !isDrawing(model) || model.scene.turns === 0 ? { model } : { model: withScene(model, (scene) => ({ ...scene, turns: 0 })), commands: [TurnScene({ turns: 0 })] },

    // Hiding removes the canvas, which ends the Mount and frees the GPU. Showing starts a new one.
    ClickedToggleScene: () => ({ model: withScene(model, (scene) => ({ ...scene, isShown: !scene.isShown, status: SceneStatus.Loading() })) }),

    // The Mount's args are as old as the render that placed the canvas. Send what is true now.
    StartedScene: () => ({
      model: withScene(model, (scene) => ({ ...scene, status: SceneStatus.Ready() })),
      commands: [DrawBars({ bars: barsOf(model) }), TurnScene({ turns: model.scene.turns })]
    }),

    FailedStartScene: ({ reason }) => ({ model: withScene(model, (scene) => ({ ...scene, status: SceneStatus.Unavailable({ reason }) })) }),

    LostSceneContext: () => (model.scene.status._tag === "Ready" ? { model: withScene(model, (scene) => ({ ...scene, status: SceneStatus.Lost() })) } : { model }),

    RestoredSceneContext: () =>
      model.scene.status._tag === "Lost"
        ? { model: withScene(model, (scene) => ({ ...scene, status: SceneStatus.Ready() })), commands: [DrawBars({ bars: barsOf(model) })] }
        : { model },

    CompletedDrawBars: () => ({ model }),
    CompletedTurnScene: () => ({ model })
  })

export const update = (model: Model, message: Message): Return => {
  if (isSceneMessage(message)) return updateScene(model, message)
  const notes = notesUpdate(model, message)
  return redraw(model, { model: { ...notes.model, scene: model.scene }, ...(notes.commands === undefined ? {} : { commands: notes.commands }) })
}

// INIT -----------------------------------------------------------------------

export const emptyApp: Model = { ...emptyModel, scene: initialScene }

export const init = (): Return => {
  const notes = notesInit()
  return { model: { ...notes.model, scene: initialScene }, ...(notes.commands === undefined ? {} : { commands: notes.commands }) }
}

// SUBSCRIPTIONS --------------------------------------------------------------

export const subscriptions = notesSubscriptions

// VIEW -----------------------------------------------------------------------

/**
 * The template's view is typed for its own Messages, and Foldkit ties a builder to one
 * Message set. So it is embedded as a Submodel view. Every notes Message is also a Message
 * of this app, so the lift to the parent is the identity.
 */
const notesBody = Submodel.defineView<NotesModel, NotesMessage>((model, h) => notesView(model, h).body)

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  // The same title rule as main.ts. A Document's title can't cross the Submodel boundary.
  const unsaved = model.pending.filter((p) => p.phase._tag !== "Saved").length
  return {
    title: unsaved > 0 ? `(${unsaved}) Notes` : "Notes",
    body: h.div([h.Class("shell")], [
      h.submodel({ slotId: "notes", model, view: notesBody, toParentMessage: (message) => message }),
      sceneView(model, h)
    ])
  }
}
