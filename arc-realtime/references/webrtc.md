# WebRTC

Read this before adding a browser-to-browser connection. It says what the overlay proves, how the handshake runs, and what nobody has verified here.

## What the overlay proves

`PASS`, in headless Chromium and in Chromium 152, against the mock and against local workerd: two pages in two browser contexts on one machine open an `RTCPeerConnection` data channel, with the handshake carried by the room socket, and one message crosses from the page that opened the link to the other.

That is all it proves. The connection has no ICE servers (`iceServers: []`), so the browsers only offer addresses on the machine itself. Everything in "Unverified" below is `NOT_RUN`.

## How the handshake runs (`src/peer.ts`, `src/main.ts`)

1. One person presses "Connect directly". `update` picks the other peer from the presence list and returns the `OfferDirect` Command.
2. `OfferDirect` asks the `PeerLink` service for an offer. The service makes the connection and the data channel, waits until ICE gathering is complete, and returns the description. The Command sends it as one `signal` frame with `kind: "offer"`.
3. The server checks the frame and relays it to the named peer, with `from` filled in.
4. The other page gets `ReceivedOffer`. `update` returns `AnswerDirect`, which asks the service for an answer and sends it back as one `signal` frame with `kind: "answer"`.
5. The first page gets `ReceivedAnswer`, and `AcceptAnswer` applies it.
6. The channel opens on both pages. Each gets `OpenedDirect` from the peer Subscription. "Wave" then sends one message through `SendWave`, and the other page gets `ReceivedWave`.

## Rules

- **The connection lives in a service, not in the Model.** `PeerLink` holds the `RTCPeerConnection` and the channel. The Model holds only the `Direct` union: `Idle`, `Opening`, `Open`, `Failed`. A test provides a stub `PeerLink`.
- **Steps are Commands, events are a Subscription.** Every Command ends in a Message, with `FailedDirect` for any failure. `peerMessages` turns the channel's open, message and close events into Messages.
- **A peer is as untrusted as a server.** The channel's message is decoded with a Schema. Anything but the one known message becomes `FailedDecodeFrame`.
- **The handshake is two frames.** Each side waits for ICE gathering to finish and sends one description with every candidate inside. With no ICE servers that took milliseconds. The other way is trickle ICE, which sends each candidate as it is found. It connects sooner once STUN or TURN servers are in play, and it needs a third signal kind in `cloudflare/room.ts`, in both servers and in the frame Schema.
- **A tie gives way by peer id.** When both people press at once, each has an offer out and receives one. The smaller peer id drops its own offer and answers. The other ignores the offer it received.
- **An open link outlives the room socket.** It is its own connection, so `ClosedSocket` leaves `Open` alone. A handshake that was still travelling over the socket fails, and so does one whose peer left or whose signal the server rejected. Each failure has the same screen: "The direct link didn't open. Notes still sync through the server."
- **One link, to one other person.** The overlay links to the first other peer in the presence list. A link between every pair grows with the square of the group. Past a few people that is a job for a media server, which is a placement question.

## Unverified

Nothing in this table ran. Each row says what to check before building on it.

| Need | Status | What to check |
|---|---|---|
| Two people on different networks | `NOT_RUN` | The connection needs ICE servers: a STUN server to learn a public address, and a TURN server to relay when no direct path exists. They go in `iceServers` in `PeerLink.layer`. Gathering then takes longer, so revisit `GATHER_TIMEOUT_MS` and consider trickle ICE. |
| A TURN server | `NOT_RUN` | Which service, and where it runs, is a placement decision for `arc-system-architecture`. In the Cloudflare Realtime docs, TURN section (`https://developers.cloudflare.com/realtime/turn/`), check how credentials are created and how long they last, the server addresses and ports, the limits, and the price. Mint credentials on your server for each session. A credential in the client bundle is public. |
| Camera and microphone | `NOT_RUN` | Media needs the browser's permission prompt (`getUserMedia`), tracks added to the connection before the offer, and a `<video>` element that is given the stream. Giving an element a stream is imperative DOM code, so in Foldkit it is a Mount (see `foldkit-rules.md`, Mounts). Every state needs a screen: asking, denied, no device, connecting, live, ended. A headless browser needs a fake camera to test this. How Chromium provides one was not checked here. |
| A group call, or one sender to many viewers | `NOT_RUN` | That is a media server (an SFU), and where it runs is a placement decision for `arc-system-architecture`. In the Cloudflare Realtime docs, SFU section (`https://developers.cloudflare.com/realtime/sfu/`), check the API for sessions and tracks, what your own server must still do for signalling and permissions, the limits, and the price. |
| Safari and Firefox | `NOT_RUN` | Only Chromium ran. |
| A deployed Worker as the signalling server | `NOT_RUN` | Only the mock and local workerd ran. |

A search on 2026-11-23 confirmed that those two docs sections exist at those addresses. Nothing else from them is relied on here. This file quotes no price, no limit and no API name from them, and neither should a reply. Read the current page.

## Placement

A TURN server or a media server is a server someone has to run or rent, so it is a placement decision. This skill names the need in one sentence, such as "a TURN relay for peers on different networks" or "a media server that fans one camera out to a group". `arc-system-architecture` chooses the service, places it, and reviews its cost, its secrets and its undo. Its table of what each UI level needs has a row for level 4 that expects this hand-over.
