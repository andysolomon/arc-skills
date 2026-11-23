# Client rules

Read this before writing a connection state. It adds to `arc-web-production`'s `foldkit-rules.md` and never replaces it. Each rule names the overlay file that shows it.

## File shape

| File | Holds |
|---|---|
| `src/model.ts` | The `Connection` and `Direct` unions, the realtime Model fields and the realtime Messages. Additions are marked `arc-realtime`. |
| `src/realtime.ts` | The frame Schemas, `frameToMessage`, the `RoomSocket` service, the `socketMessages` stream, `backoffMs` and the `WaitBackoff` Command. |
| `src/peer.ts` | The `PeerLink` service, the `peerMessages` stream and the WebRTC Commands. See [webrtc.md](webrtc.md). |
| `src/main.ts` | The realtime cases of `update`, the socket and peer Subscriptions, and each state's screen. |
| `src/entry.ts` | Provides `RoomSocket.layer` and `PeerLink.layer` beside the HTTP client, and imports `realtime.css`. |
| `src/realtime.css` | Realtime styles. The style lint checks it through the `lint:styles` script. |
| `test/realtime.test.ts` | Story, Scene, stream and Command tests. Runs in Node. |
| `test/two-people.browser.mjs` | The two-person check in a real browser. Not part of `npm test`. |

Everything except `entry.ts` still imports cleanly in Node. `realtime.ts` and `peer.ts` name `WebSocket`, `location` and `RTCPeerConnection` only inside a service's layer, which only the browser builds.

## The state machine (`src/model.ts`, `src/main.ts`)

| State | The socket | Screen | Leaves on |
|---|---|---|---|
| `Connecting { attempt }` | opening | "Connecting…" when `attempt` is 0, "Reconnecting…" after a failure | the welcome frame, or a close |
| `Live` | open and welcomed | "Live" and the presence count | a close |
| `Reconnecting { attempt }` | none; the backoff is running | "Reconnecting…", "The live connection dropped. Trying again.", and the last notes | `ElapsedBackoff` for the same attempt |
| `Offline` | none | "Offline", what still works, and a Reconnect button | the Reconnect button |

- **Live starts at the welcome frame**, not at the socket's `open` event. The welcome proves the room answered, and it carries this client's peer id.
- **A close counts a failure.** From `Live` the next attempt is 1. From `Connecting { attempt }` it is `attempt + 1`. Past `MAX_RETRIES` (5) the state is `Offline`.
- **Guard every transition.** A welcome outside `Connecting`, a close outside `Connecting` or `Live`, and a backoff for another attempt all return the Model unchanged.
- **Presence is unknown while not live.** A close empties `peers` and `self`. The screen then shows no count. It never shows a stale one or a zero.
- **The last good data stays.** Nothing in a close touches `notes` or `arrived`. When the list itself can't refresh, the screen keeps it and says "Couldn't refresh the list. These are the last notes received."

## The socket is a Subscription (`src/realtime.ts`, `src/main.ts`)

- **One entry, with one dependency.** `wanted` is true in `Connecting` and `Live`. When it turns false the runtime drops the stream, which closes the socket. When it turns true again the runtime starts a new stream, which dials. `update` never opens or closes a socket itself.
- **The stream owns the socket.** `RoomSocket.events` opens the socket inside `Effect.acquireRelease`, so the release closes it. The stream emits `Frame` events and ends after one `Closed` event.
- **Decode every frame.** `frameToMessage` runs one Schema over the raw frame. It is `Schema.fromJsonString` over a union of the five frame shapes. Text that is not JSON, a wrong shape, an unknown type and a binary frame all become `FailedDecodeFrame`. Nothing throws.
- **One past-tense Message per frame type.** `ReceivedWelcome`, `ChangedPresence`, `ReceivedNote`, `ReceivedOffer`, `ReceivedAnswer`, `RejectedFrame`. The close is `ClosedSocket`.
- **A frame that fails to decode changes nothing on screen.** `update` returns the Model unchanged. The Message keeps the cause for tests and DevTools.
- **Don't branch on the close code.** Node's client closed its own socket and saw code 1000 from the mock and code 1006 from local `cf:dev`. Treat every close the same.
- **A handshake that never finishes becomes a retry.** The service closes a socket that has not opened after 10 seconds.
- **The URL comes from the page's origin** (`location.host`, `wss` on https). There is no base URL setting and no CORS.

## Sending is a Command (`src/peer.ts`)

- **`RoomSocket.send` is the only way out.** A Command asks for the service by type. The browser gets `RoomSocket.layer` through `resources` in `entry.ts`, and a test provides a stub with `Layer.succeed`.
- **A send on a closed socket fails as a Message.** `send` fails with `SocketNotOpen`, and the Command's `Effect.catch` turns it into `FailedDirect`. The error channel stays `never`.
- **The client's writes stay on HTTP.** `SaveNote` is the template's Command, unchanged. It has a status code, a retry and a phase union, and it works with no socket. The server also accepts an `add` frame for clients that write often enough to need it. This app sends none.

## Time comes in through Messages

- **`update` picks the delay with a pure function.** `backoffMs(attempt)` gives 1, 2, 4, 8 and 16 seconds, capped at 30. `update` puts that number in the Command's args, so a Story can assert it exactly.
- **The wait and the jitter happen in the Command.** `WaitBackoff` sleeps between half the delay and all of it, then answers `ElapsedBackoff { attempt }`. The random part keeps clients that dropped together from all returning in the same instant.
- **Every timing number of this level lives in `src/realtime.ts`.** That is the retry count, the backoff base and cap, the connect timeout and the ICE timeout. They are JavaScript values because a CSS token can't hold a retry schedule. The CSS in `realtime.css` still uses only the timing tokens.

## Catch-up after a reconnect

- **The welcome frame starts a list load.** Whatever was stored while this client was away is in the list, so the same idempotent `GET` is the catch-up. The server keeps no log per client. A list too large to reload needs a sequence number and a replay instead, which the overlay does not build.
- **A load already in flight may be older than the socket.** Then `update` sets `catchUpOwed`, and the next list result starts one more load.
- **Notes from the socket wait in `arrived`.** A list load removes the ones it contains and keeps the rest, because that list was read before those notes were stored. Putting a frame straight into the loaded list would let an older list result delete it.
- **A note frame settles one of our own rows the way a list load does.** It removes a row that is not mid-save, such as a failed save the server kept. A saving row waits for its own reply.
- **The poll rests while live.** `refreshDue` loads on a tick when the socket is not live, which is the fallback, and once after a save, which confirms the "saved" row.

## Tests

- **Story** walks `update` through connecting, live, reconnecting and live again, and asserts `WaitBackoff({ attempt: 1, delayMs: 1000 })` and the catch-up `FetchNotes`.
- **Direct `update` calls** cover the retry ladder up to `Offline`, a welcome during a list load, and both sides of a WebRTC tie. Two things in flight can't be a Story.
- **Scene** checks each state's words by role and text, and feeds frames with `Scene.Subscription.emit(Message…)`.
- **The stream** runs against a stub `RoomSocket` that plays a welcome, a bad frame, a note and a close. The result must be four Messages in that order.
- **Each send Command** runs against stub services. The test reads the exact frame that was sent, then repeats with a closed socket and expects a failure Message.
- **The browser test** uses two browser contexts, which share no storage and no sockets. It counts list requests on the second page to prove the note came over the socket.

## Pitfalls

Each of these cost time while the overlay was built.

- **A stream built at import time must not touch `window`.** Build the socket inside `Stream.callback`, and reach the service through `Stream.unwrap`. Then `main.ts` still imports in Node.
- **Vite's proxy drops the upgrade unless `ws: true` is set.** The overlay's `vite.config.ts` sets it for `/api`.
- **The dev page opens other sockets.** Vite's reload socket and Foldkit DevTools each have one. A test that drops "the socket" must pick the room socket by its URL.
- **Don't wait on the "saved" badge in a browser test.** The next list load removes it, so the wait sometimes misses it. Wait for the `POST` response.
- **Kill a server by the pid of its own process.** `npx vite` is a wrapper, and killing the wrapper can leave Vite holding the port. The overlay test starts `node node_modules/vite/bin/vite.js`.
- **A side-effect CSS import needs a type shim.** `src/css.d.ts` declares `*.css`, or `tsc` rejects `import "./realtime.css"`.
