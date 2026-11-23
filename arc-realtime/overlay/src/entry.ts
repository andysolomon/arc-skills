/**
 * Browser entry: boot the Foldkit Runtime. Everything else imports and tests without a DOM.
 * `resources: Http.layer` gives every Command a fetch-backed HttpClient. Requests use
 * relative URLs, so they go to whatever served this page.
 *
 * arc-realtime: the room socket and the peer link are services too. They are provided here,
 * once, so Commands and Subscriptions ask for them by type and tests can swap in stubs.
 */
import { Layer } from "effect"
import { Http, Runtime } from "foldkit"
import { init, Model, subscriptions, update, view } from "./main.ts"
import { PeerLink } from "./peer.ts"
import { RoomSocket } from "./realtime.ts"
import "./realtime.css" // arc-realtime: Vite bundles it; the style lint checks it

const resources = Layer.mergeAll(Http.layer, RoomSocket.layer, PeerLink.layer)

Runtime.run(
  Runtime.makeApplication({ Model, init, update, view, subscriptions, resources, container: document.getElementById("root") })
)
