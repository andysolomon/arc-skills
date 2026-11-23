/**
 * SCENE MODEL and MESSAGES. Data definitions only: no DOM, no three.js.
 *
 * The Model holds what the user can see and change: whether the chart is shown, which
 * state the scene is in, and how far the view is turned. The renderer, its geometries and
 * its listeners are not state. They live in the Mount (mount.ts) and die with the element.
 */
import { Schema } from "effect"
import { defineMessageUnion } from "foldkit/message"
import { defineTaggedUnion } from "foldkit/schema"

/** Every status has its own screen in view.ts. */
export const SceneStatus = defineTaggedUnion({
  /** The canvas is in the page; the three.js chunk and the renderer are not ready yet. */
  Loading: {},
  Ready: {},
  /** No WebGL 2, or the scene failed to start. The view shows the data as a table instead. */
  Unavailable: { reason: Schema.String },
  /** The browser took the GPU context away. It gives it back by itself. */
  Lost: {}
})
export type SceneStatus = typeof SceneStatus.Type

export const SceneModel = Schema.Struct({
  isShown: Schema.Boolean,
  status: SceneStatus,
  /** Eighths of a full turn around the chart. 0 is the starting view. */
  turns: Schema.Number
})
export type SceneModel = typeof SceneModel.Type

export const initialScene: SceneModel = { isShown: true, status: SceneStatus.Loading(), turns: 0 }

export const SceneMessage = defineMessageUnion({
  // From the user
  ClickedTurnScene: { by: Schema.Number },
  ClickedResetScene: {},
  ClickedToggleScene: {},
  // From the Mount
  StartedScene: {},
  FailedStartScene: { reason: Schema.String },
  LostSceneContext: {},
  RestoredSceneContext: {},
  // From Commands
  CompletedDrawBars: { drawn: Schema.Boolean },
  CompletedTurnScene: { drawn: Schema.Boolean }
})
export type SceneMessage = typeof SceneMessage.Type
