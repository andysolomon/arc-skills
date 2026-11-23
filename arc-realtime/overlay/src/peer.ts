/**
 * arc-realtime: a browser-to-browser data channel (WebRTC), as Foldkit sees it.
 *
 *   handshake  Commands. An offer and an answer travel over the room socket as `signal`
 *              frames. The server only relays them (cloudflare/room.ts).
 *   incoming   a Subscription. `peerMessages` turns the channel's events into Messages.
 *   outgoing   a Command, through `PeerLink.send`.
 *
 * `PeerLink` is a service, so tests swap in a stub and the browser gets `PeerLink.layer`.
 *
 * What this file proves and what it does not: a data channel between two pages on one
 * machine, with no STUN or TURN server (`iceServers` is empty). Two networks need those
 * servers, and camera or microphone tracks need more than this. See references/webrtc.md.
 */
import { Context, Data, Effect, Layer, Queue, Schema, Stream } from "effect"
import { Command } from "foldkit"
import { Message } from "./model.ts"
import { GATHER_TIMEOUT_MS, RoomSocket } from "./realtime.ts"

/** The one message this demo sends over the channel. A peer is untrusted too: anything else fails to decode. */
const WAVE = "wave"

export type PeerEvent = { readonly _tag: "Opened" } | { readonly _tag: "Received"; readonly data: unknown } | { readonly _tag: "Closed" }

export class PeerError extends Data.TaggedError("PeerError")<{ readonly message: string }> {}

export class PeerLink extends Context.Service<PeerLink, {
  readonly events: Stream.Stream<PeerEvent>
  /** Starts a connection and a channel. Answers with the offer, ICE candidates included. */
  readonly offer: Effect.Effect<string, PeerError>
  /** Takes someone's offer. Answers with the answer, ICE candidates included. */
  readonly answer: (sdp: string) => Effect.Effect<string, PeerError>
  /** Applies the answer to the offer this side made. */
  readonly accept: (sdp: string) => Effect.Effect<void, PeerError>
  readonly send: (text: string) => Effect.Effect<void, PeerError>
}>()("app/PeerLink") {
  static readonly layer = Layer.sync(PeerLink, () => {
    let connection: RTCPeerConnection | undefined
    let channel: RTCDataChannel | undefined
    const listeners = new Set<(event: PeerEvent) => void>()
    const emit = (event: PeerEvent) => listeners.forEach((listener) => listener(event))
    const failed = (error: unknown) => new PeerError({ message: error instanceof Error ? error.message : String(error) })

    /** One connection at a time: a new handshake replaces the old one. */
    const fresh = (): RTCPeerConnection => {
      connection?.close()
      channel = undefined
      const next = new RTCPeerConnection({ iceServers: [] })
      connection = next
      next.addEventListener("connectionstatechange", () => {
        if (connection === next && next.connectionState === "failed") emit({ _tag: "Closed" })
      })
      return next
    }
    const adopt = (next: RTCDataChannel) => {
      channel = next
      next.addEventListener("open", () => emit({ _tag: "Opened" }))
      next.addEventListener("message", (event) => emit({ _tag: "Received", data: event.data }))
      next.addEventListener("close", () => {
        if (channel === next) emit({ _tag: "Closed" })
      })
    }
    /**
     * Waits until every ICE candidate is in the description, so the handshake is two frames:
     * one offer, one answer. Sending candidates one by one as they are found (trickle ICE)
     * connects sooner when STUN or TURN servers are in play, and needs a third signal kind.
     */
    const gathered = (pc: RTCPeerConnection) =>
      new Promise<string>((resolve, reject) => {
        const done = () => {
          if (pc.iceGatheringState !== "complete") return
          clearTimeout(timeout)
          resolve(pc.localDescription?.sdp ?? "")
        }
        const timeout = setTimeout(() => reject(new Error("ICE gathering timed out")), GATHER_TIMEOUT_MS)
        pc.addEventListener("icegatheringstatechange", done)
        done()
      })

    return PeerLink.of({
      events: Stream.callback<PeerEvent>((queue) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const listener = (event: PeerEvent) => void Queue.offerUnsafe(queue, event)
            listeners.add(listener)
            return listener
          }),
          (listener) => Effect.sync(() => void listeners.delete(listener))
        )
      ),
      offer: Effect.tryPromise({
        try: async () => {
          const pc = fresh()
          adopt(pc.createDataChannel("room"))
          await pc.setLocalDescription(await pc.createOffer())
          return gathered(pc)
        },
        catch: failed
      }),
      answer: (sdp) =>
        Effect.tryPromise({
          try: async () => {
            const pc = fresh()
            pc.addEventListener("datachannel", (event) => adopt(event.channel))
            await pc.setRemoteDescription({ type: "offer", sdp })
            await pc.setLocalDescription(await pc.createAnswer())
            return gathered(pc)
          },
          catch: failed
        }),
      accept: (sdp) =>
        Effect.tryPromise({
          try: async () => {
            if (connection === undefined) throw new Error("no offer was made")
            await connection.setRemoteDescription({ type: "answer", sdp })
          },
          catch: failed
        }),
      send: (text) =>
        Effect.suspend(() => {
          const open = channel
          return open !== undefined && open.readyState === "open" ? Effect.sync(() => open.send(text)) : Effect.fail(new PeerError({ message: "the direct link is not open" }))
        })
    })
  })
}

// THE SUBSCRIPTION STREAM ----------------------------------------------------

const decodeWave = Schema.decodeUnknownOption(Schema.Literal(WAVE))

/** The channel's events, as Messages. Runs for the app's whole life; it is silent until a link exists. */
export const peerMessages: Stream.Stream<Message, never, PeerLink> = Stream.unwrap(
  Effect.gen(function*() {
    const peer = yield* PeerLink
    return peer.events.pipe(
      Stream.map((event): Message => {
        if (event._tag === "Opened") return Message.OpenedDirect()
        if (event._tag === "Closed") return Message.ClosedDirect()
        return decodeWave(event.data)._tag === "Some" ? Message.ReceivedWave() : Message.FailedDecodeFrame({ error: "an unknown message on the direct link" })
      })
    )
  })
)

// COMMANDS -------------------------------------------------------------------
// Each one ends in a Message whatever happens, so the error channel is `never`.

const failedDirect = (error: { readonly message: string }) => Effect.succeed(Message.FailedDirect({ error: error.message }))
const signal = (to: string, kind: "offer" | "answer", sdp: string) => JSON.stringify({ type: "signal", to, kind, sdp })

export const OfferDirect = Command.define("OfferDirect", {
  args: { to: Schema.String },
  messages: [Message.SentSignal, Message.FailedDirect],
  execute: ({ to }) =>
    Effect.gen(function*() {
      const peer = yield* PeerLink
      const socket = yield* RoomSocket
      yield* socket.send(signal(to, "offer", yield* peer.offer))
      return Message.SentSignal({ to })
    }).pipe(Effect.catch(failedDirect))
})

export const AnswerDirect = Command.define("AnswerDirect", {
  args: { from: Schema.String, sdp: Schema.String },
  messages: [Message.SentSignal, Message.FailedDirect],
  execute: ({ from, sdp }) =>
    Effect.gen(function*() {
      const peer = yield* PeerLink
      const socket = yield* RoomSocket
      yield* socket.send(signal(from, "answer", yield* peer.answer(sdp)))
      return Message.SentSignal({ to: from })
    }).pipe(Effect.catch(failedDirect))
})

export const AcceptAnswer = Command.define("AcceptAnswer", {
  args: { sdp: Schema.String },
  messages: [Message.AppliedAnswer, Message.FailedDirect],
  execute: ({ sdp }) =>
    Effect.gen(function*() {
      const peer = yield* PeerLink
      yield* peer.accept(sdp)
      return Message.AppliedAnswer()
    }).pipe(Effect.catch(failedDirect))
})

export const SendWave = Command.define("SendWave", {
  messages: [Message.SentWave, Message.FailedDirect],
  execute: Effect.gen(function*() {
    const peer = yield* PeerLink
    yield* peer.send(WAVE)
    return Message.SentWave()
  }).pipe(Effect.catch(failedDirect))
})
