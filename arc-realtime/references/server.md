# The room server

Read this before changing `cloudflare/worker.ts` or `scripts/mock-api.ts`. The two servers must keep one contract, sockets included. `scripts/api-check.ts` checks it against each.

## The protocol (`cloudflare/room.ts`)

The room is one WebSocket route, `/api/room`. A frame is one JSON text message.

| Direction | Frame | When |
|---|---|---|
| server to client | `{ type: "welcome", peer, peers }` | once, after the socket is accepted |
| server to client | `{ type: "presence", peers }` | to everyone, when someone joins or leaves |
| server to client | `{ type: "note", note: { id, text } }` | to everyone, when a note is stored |
| server to client | `{ type: "signal", from, kind, sdp }` | to one peer, relayed from another |
| server to client | `{ type: "rejected", reason }` | to the sender of a frame that failed a check |
| client to server | `{ type: "add", id, text }` | the same write as `POST /api/notes` |
| client to server | `{ type: "signal", to, kind, sdp }` | relayed to peer `to`; `kind` is `offer` or `answer` |

`cloudflare/room.ts` holds the route, the size caps, `checkNote`, `parseClientFrame` and the frame builders. It is plain TypeScript with no platform types, so the Worker and the mock both import it. A rule written once can't drift between them.

## The server never trusts a frame

- **Every client frame goes through `parseClientFrame`.** It must be text, at most 16,000 characters, valid JSON, an object, and one of the two known types with fields of the right type and size. Anything else gets a `rejected` frame, and the socket stays open.
- **The caps are this app's own choices**, not platform limits: 2,000 characters of note text, 16,000 per frame, 12,000 per SDP.
- **The server mints the peer id.** A client never says who it is. A relayed `signal` carries `from`, which the server fills in from the socket.
- **A write frame is the HTTP write.** `add` and `POST` share `checkNote` and one `store` function. The note's id is the idempotency key in both. A second insert with the same id stores nothing.
- **Only a new note is announced.** A repeated save sends no second `note` frame. The API check proves this on both paths.
- **A signal goes to one named peer.** A `to` that is not connected gets `rejected`. The server reads no SDP. It checks the kind and the length.
- **There is no sign-in, as in the template.** Anyone with the URL can join the room. Add authentication before real use, and check it on the upgrade request, before the socket is accepted.

## The Worker (`cloudflare/worker.ts`)

The Durable Object holds the sockets with the WebSocket hibernation API. These names were found in the installed type file, `node_modules/@cloudflare/workers-types/index.d.ts`, version 5.20261123.1:

- on `DurableObjectState`: `acceptWebSocket(ws, tags?)`, `getWebSockets(tag?)`, `getTags(ws)`, `setWebSocketAutoResponse(pair?)`;
- on the `DurableObject` class: the handlers `webSocketMessage(ws, message)`, `webSocketClose(ws, code, reason, wasClean)` and `webSocketError(ws, error)`;
- on `WebSocket`: `serializeAttachment(value)` and `deserializeAttachment()`;
- `WebSocketPair`, and `webSocket` in `ResponseInit`.

How the overlay uses them:

- **`fetch` accepts the socket.** It makes a `WebSocketPair`, calls `this.ctx.acceptWebSocket(server, [peer])` with the peer id as the only tag, and answers 101 with the client end.
- **No socket lives in a field.** `this.ctx.getWebSockets()` lists the room, `this.ctx.getTags(ws)[0]` is a socket's peer id, and `this.ctx.getWebSockets(peer)[0]` finds one peer. The runtime keeps the list, so the object has no state of its own to lose.
- **The handlers do the work.** `webSocketMessage` checks the frame and stores or relays. `webSocketClose` and `webSocketError` tell the others who is left.
- **Not used here.** Attachments would hold more per-socket data than a tag. `setWebSocketAutoResponse` would answer a keep-alive ping without waking the object. The overlay has no keep-alive.
- **One room.** The template's Worker sends every request to the object named `root`. An app with many rooms picks the object by room id in the Worker's `fetch`, and the route carries that id.

### What ran, and what did not

- `PASS` on local workerd (`npm run cf:dev`, workerd 1.20261026.1 from the template's lockfile): the API check with the socket check, and the two-person browser test, against the built app and the Worker on one origin.
- `NOT_RUN`: a deployed Worker. Nothing in this skill has run on Cloudflare's network.
- `NOT_RUN`: hibernation itself. The checks prove the hibernation API accepts, lists and serves sockets. They never made the object leave memory and come back.
- Unverified: every Cloudflare limit and price. This file quotes none. Before relying on one, read the current page: `https://developers.cloudflare.com/durable-objects/best-practices/websockets/` and the Durable Objects limits and pricing pages. Check how many sockets one object may hold, the largest message, what a held socket costs, and what stops an object from hibernating.

### Two things local workerd showed

- **`rowsWritten` can't tell a new insert from an ignored one.** With `INSERT OR IGNORE`, the cursor's `rowsWritten` was above zero for a repeat, so a repeated save was announced twice. The Worker now uses `INSERT OR IGNORE ... RETURNING id`, which yields a row only when one was stored. The API check caught this.
- **The close handler must close the socket.** Without `ws.close()` in `webSocketClose`, Node's client never saw its own close finish within 5 seconds. With it, the close finished in milliseconds. Cloudflare's WebSockets page, as a search on 2026-11-23 summarised it, says the runtime answers a Close frame itself from compatibility date 2026-04-07, and that calling `close()` stays safe. The template's date is 2026-10-01 and local `cf:dev` still needed the call, so the overlay keeps it. Whether a deployed Worker needs it is `NOT_RUN`.

## The mock (`scripts/mock-api.ts`)

The mock serves the socket with the `ws` package, pinned exactly as a devDependency. Node has a WebSocket client and no server. A hand-written upgrade handler would need its own frame parser (masking, split frames, partial reads), which is code to keep correct that the app never ships. `ws` 8.23.0 and `@types/ws` 8.18.2 are already in the template's lockfile through other packages, so pinning them adds no download.

The mock keeps the same contract through the same module: it imports `checkNote`, `parseClientFrame` and the frame builders from `cloudflare/room.ts`. Its room is a `Map` from peer id to socket.

Switches, in the style of the template's `DELAY_MS` and `FAIL_SAVES`:

| Switch | What the app shows |
|---|---|
| none | "Live" and the presence count |
| `DELAY_MS=4000` | "Connecting…" for that long, because the handshake waits too. Loading and Saving wait as before. Above 10000 the client's own timeout turns it into "Reconnecting…" |
| `REFUSE_SOCKETS=1` | every handshake answers 503 while HTTP keeps working: "Reconnecting…" through the backoff, then "Offline" after about 16 to 31 seconds |
| `DROP_SOCKET_AFTER_MS=4000` | each socket closes that long after it opens: live, reconnecting, live again, with a list load each time |
| stop the process | HTTP and the socket both fail: the last list stays with the stale line, and the status goes "Reconnecting…", then "Offline" |

## The API check (`scripts/api-check.ts`, `scripts/socket-check.ts`)

`npm run api:check -- <url>` runs the template's HTTP checks, then `checkSocket`. It uses Node's own `WebSocket` client, so it needs no package. It writes a few notes with random ids, so run it on local or test data only. It checks that:

- a plain `GET` on the room answers 426;
- a welcome names the socket's own peer id, and a second socket is announced to the first;
- a note saved over HTTP reaches both sockets, and the same save again is not announced;
- an `add` frame stores the note once and announces it once, even when sent twice;
- bad JSON, blank text, an unknown type and a binary frame are each rejected, store nothing, and leave the socket open;
- a signal reaches only the named peer with `from` filled in by the server, and a signal to nobody, or of an unknown kind, is rejected;
- a socket that leaves is announced to the rest.

A check that must see nothing waits on a later frame, not on a timer. After the repeated save it stores a second note and asserts that no duplicate arrived before it.

Run it against both servers after any change to the room:

```
PORT=8787 npm run mock      # then: npm run api:check -- http://127.0.0.1:8787
PORT=8788 npm run cf:dev    # then: npm run api:check -- http://127.0.0.1:8788
```

## Stopping `cf:dev`

`cf:dev` starts workerd in its own session, so killing `npm` alone leaves the port held. In a terminal, press Ctrl-C and wait for the port to close (`ss -ltn`). From a script, send SIGINT to npm's process group, which is what Ctrl-C does, then wait:

```
set -m; PORT=8788 npm run cf:dev > cfdev.log 2>&1 & dev=$!; set +m
# ... run the checks ...
kill -INT -- "-$dev"
while ss -ltn | grep -q ":8788 "; do sleep 0.5; done
```

`tests/test-overlay.sh` does this and fails if the port stays open. Local data lives in `cloudflare/.alchemy/`. Delete that folder to reset it.
