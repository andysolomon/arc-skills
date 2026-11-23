/**
 * MOUNTS: the one way imperative DOM code enters the view. Each Mount wraps a plain
 * function from src/interaction/ and turns what it reports into a Message.
 *
 * The rules every Mount here keeps:
 *   - The resource is built INSIDE `Effect.acquireRelease`, never before it. The release
 *     runs when the element leaves the DOM, so no listener or animation outlives its row.
 *   - Args are read once, at mount. Nothing here reads the Model.
 *   - A Mount reports facts. `update` decides what they mean.
 */
import { Effect, Queue, Schema, Stream } from "effect"
import { Mount } from "foldkit"
import { attachEmptyFigure } from "./interaction/figure.ts"
import { attachLayoutMoves } from "./interaction/layout.ts"
import { attachSwipe } from "./interaction/swipe.ts"
import { Message } from "./model.ts"

/**
 * A row that follows the pointer. A stream, because the swipe may happen at any time or
 * never. It emits two facts: the row is listening, and later, perhaps, the row has left the
 * screen.
 *
 * The first one changes nothing in the Model. It exists for Scene tests. A scene must
 * resolve every Mount it renders before its next step, and a Mount whose only Message
 * removes a note would force every scene with a row in it to remove that note.
 */
type SwipeMessage = typeof Message.CompletedAttachSwipe.Type | typeof Message.SwipedAwayNote.Type

export const SwipeNote = Mount.defineStream("SwipeNote", {
  args: { noteId: Schema.String },
  messages: [Message.CompletedAttachSwipe, Message.SwipedAwayNote],
  execute: ({ element, noteId }) =>
    Stream.callback<SwipeMessage>((queue) =>
      Effect.gen(function*() {
        yield* Effect.acquireRelease(
          Effect.sync(() => attachSwipe(element as HTMLElement, () => Queue.offerUnsafe(queue, Message.SwipedAwayNote({ noteId })))),
          (detach) => Effect.sync(detach)
        )
        Queue.offerUnsafe(queue, Message.CompletedAttachSwipe())
        return yield* Effect.never
      })
    )
})

/** Rows travel to their new places when one is added or removed. It reports once, that it is watching. */
export const MoveRows = Mount.define("MoveRows", {
  messages: [Message.CompletedMoveRows],
  execute: ({ element }) =>
    Effect.gen(function*() {
      yield* Effect.acquireRelease(
        Effect.sync(() => attachLayoutMoves(element as HTMLElement)),
        (detach) => Effect.sync(detach)
      )
      return Message.CompletedMoveRows()
    })
})

/** The empty-state figure. `label` is its accessible name, read once at mount. */
export const DrawEmptyFigure = Mount.define("DrawEmptyFigure", {
  args: { label: Schema.String },
  messages: [Message.CompletedDrawEmptyFigure],
  execute: ({ element, label }) =>
    Effect.gen(function*() {
      yield* Effect.acquireRelease(
        Effect.sync(() => attachEmptyFigure(element as HTMLElement, label)),
        (detach) => Effect.sync(detach)
      )
      return Message.CompletedDrawEmptyFigure()
    })
})
