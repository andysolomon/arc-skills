/**
 * SCENE COMMANDS: how a Model change reaches the running scene.
 *
 * A Mount reads its args once. So when a Message changes what the scene should show,
 * `update` returns one of these, and the Command finds the scene (handle.ts) and tells it.
 * When no scene is running (hidden, still loading, no WebGL) the Command does nothing and
 * says so in its Message. The Mount draws the current data when it starts.
 */
import { Effect, Schema } from "effect"
import { Command } from "foldkit"
import { Bars } from "./data.ts"
import { findScene } from "./handle.ts"
import { SceneMessage } from "./model.ts"

export const DrawBars = Command.define("DrawBars", {
  args: { bars: Bars },
  messages: [SceneMessage.CompletedDrawBars],
  execute: ({ bars }) =>
    Effect.sync(() => {
      const scene = findScene()
      scene?.setBars(bars)
      return SceneMessage.CompletedDrawBars({ drawn: scene !== undefined })
    })
})

export const TurnScene = Command.define("TurnScene", {
  args: { turns: Schema.Number },
  messages: [SceneMessage.CompletedTurnScene],
  execute: ({ turns }) =>
    Effect.sync(() => {
      const scene = findScene()
      scene?.setTurns(turns)
      return SceneMessage.CompletedTurnScene({ drawn: scene !== undefined })
    })
})
