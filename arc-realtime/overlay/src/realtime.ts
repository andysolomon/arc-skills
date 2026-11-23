/**
 * arc-realtime: the room socket, as Foldkit sees it.
 *
 *   incoming   a Subscription. `socketMessages` opens one socket, decodes every frame with a
 *              Schema and emits one past-tense Message per frame. A frame that does not
 *              decode becomes `FailedDecodeFrame`, never a crash. The stream ends with
 *              `ClosedSocket`.
 *   outgoing   Commands, through `RoomSocket.send`.
 *   timing     `WaitBackoff` sleeps and answers with a Message. `update` never reads a clock.
 *
 * `RoomSocket` is a service, so tests swap in a stub and the browser gets `RoomSocket.layer`
 * through `resources` in entry.ts. Nothing here touches the DOM at import time.
 *
 * Every timing number of this level lives in this file. They are JavaScript values because
 * CSS tokens cannot hold a retry schedule.
 */
import { Context, Data, Effect, Layer, Queue, Result, Schema, Stream } from "effect"
import { Command } from "foldkit"
import { Message, Note } from "./model.ts"

export const ROOM_PATH = "/api/room"
/** Retries before the app says Offline. */
export const MAX_RETRIES = 5
const BACKOFF_BASE_MS = 1000
const BACKOFF_CAP_MS = 30_000
/** A handshake that has not finished by now is closed, so it becomes a retry. */
const CONNECT_TIMEOUT_MS = 10_000
/** WebRTC: ICE gathering that has not finished by now fails the handshake. With no ICE servers it takes milliseconds. */
export const GATHER_TIMEOUT_MS = 5000

/** The wait before retry number `attempt`, starting at 1: 1 s, 2 s, 4 s, 8 s, 16 s, capped at 30 s. Pure, so `update` may call it. */
export const backoffMs = (attempt: number): number => Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** (attempt - 1))

// FRAMES ---------------------------------------------------------------------
// What the server may send (see cloudflare/room.ts). Server data is untrusted, so every
// frame is decoded before it becomes a Message.

const ServerFrame = Schema.Union([
  Schema.Struct({ type: Schema.Literal("welcome"), peer: Schema.String, peers: Schema.Array(Schema.String) }),
  Schema.Struct({ type: Schema.Literal("presence"), peers: Schema.Array(Schema.String) }),
  Schema.Struct({ type: Schema.Literal("note"), note: Note }),
  Schema.Struct({ type: Schema.Literal("signal"), from: Schema.String, kind: Schema.Literals(["offer", "answer"]), sdp: Schema.String }),
  Schema.Struct({ type: Schema.Literal("rejected"), reason: Schema.String })
])
type ServerFrame = typeof ServerFrame.Type

const decodeFrame = Schema.decodeUnknownResult(Schema.fromJsonString(ServerFrame))

const toMessage = (frame: ServerFrame): Message => {
  switch (frame.type) {
    case "welcome":
      return Message.ReceivedWelcome({ peer: frame.peer, peers: frame.peers })
    case "presence":
      return Message.ChangedPresence({ peers: frame.peers })
    case "note":
      return Message.ReceivedNote({ note: frame.note })
    case "signal":
      return frame.kind === "offer" ? Message.ReceivedOffer({ from: frame.from, sdp: frame.sdp }) : Message.ReceivedAnswer({ from: frame.from, sdp: frame.sdp })
    case "rejected":
      return Message.RejectedFrame({ reason: frame.reason })
  }
}

/** One raw frame to one Message. Text that is not JSON, a wrong shape and a binary frame all end as `FailedDecodeFrame`. */
export const frameToMessage = (data: unknown): Message =>
  Result.match(decodeFrame(data), {
    onSuccess: toMessage,
    onFailure: (error) => Message.FailedDecodeFrame({ error: error.message })
  })

// THE SOCKET SERVICE ---------------------------------------------------------

export type SocketEvent = { readonly _tag: "Frame"; readonly data: unknown } | { readonly _tag: "Closed"; readonly code: number }

export class SocketNotOpen extends Data.TaggedError("SocketNotOpen")<{}> {
  override readonly message = "the room socket is not open"
}

export class RoomSocket extends Context.Service<RoomSocket, {
  /** Opens one socket when the stream starts and closes it when the stream is dropped. Ends after `Closed`. */
  readonly events: Stream.Stream<SocketEvent>
  readonly send: (text: string) => Effect.Effect<void, SocketNotOpen>
}>()("app/RoomSocket") {
  /** The browser's implementation. The URL is built from the page's own origin, so there is no CORS and no base-URL setting. */
  static readonly layer = Layer.sync(RoomSocket, () => {
    let current: WebSocket | undefined
    return RoomSocket.of({
      events: Stream.callback<SocketEvent>((queue) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${ROOM_PATH}`)
            current = ws
            const timeout = setTimeout(() => ws.close(), CONNECT_TIMEOUT_MS)
            ws.addEventListener("open", () => clearTimeout(timeout))
            ws.addEventListener("message", (event) => Queue.offerUnsafe(queue, { _tag: "Frame", data: event.data }))
            ws.addEventListener("close", (event) => {
              clearTimeout(timeout)
              Queue.offerUnsafe(queue, { _tag: "Closed", code: event.code })
              Queue.endUnsafe(queue)
            })
            return { ws, timeout }
          }),
          ({ ws, timeout }) =>
            Effect.sync(() => {
              clearTimeout(timeout)
              if (current === ws) current = undefined
              ws.close()
            })
        )
      ),
      send: (text) =>
        Effect.suspend(() => {
          const ws = current
          return ws !== undefined && ws.readyState === WebSocket.OPEN ? Effect.sync(() => ws.send(text)) : Effect.fail(new SocketNotOpen())
        })
    })
  })
}

// THE SUBSCRIPTION STREAM ----------------------------------------------------

/** Everything one socket does, as Messages. main.ts runs it while the Model wants a socket. */
export const socketMessages: Stream.Stream<Message, never, RoomSocket> = Stream.unwrap(
  Effect.gen(function*() {
    const socket = yield* RoomSocket
    return socket.events.pipe(Stream.map((event) => (event._tag === "Frame" ? frameToMessage(event.data) : Message.ClosedSocket({ code: event.code }))))
  })
)

// COMMANDS -------------------------------------------------------------------

/**
 * The backoff wait. `update` picks `delayMs` with `backoffMs`, which is pure. The clock and
 * the jitter are side effects, so they happen here: the wait is between half of `delayMs`
 * and all of it, so clients that dropped together do not all come back in the same instant.
 */
export const WaitBackoff = Command.define("WaitBackoff", {
  args: { attempt: Schema.Number, delayMs: Schema.Number },
  messages: [Message.ElapsedBackoff],
  execute: ({ attempt, delayMs }) =>
    Effect.gen(function*() {
      const jitter = yield* Effect.sync(() => Math.random())
      yield* Effect.sleep(`${Math.round(delayMs * (0.5 + jitter / 2))} millis`)
      return Message.ElapsedBackoff({ attempt })
    })
})
