/**
 * Browser entry: boot the Foldkit Runtime. Everything else imports and tests without a DOM.
 * `resources: Http.layer` gives every Command a fetch-backed HttpClient. Requests use
 * relative URLs, so they go to whatever served this page.
 */
import { Http, Runtime } from "foldkit"
import { init, Model, subscriptions, update, view } from "./main.ts"

Runtime.run(
  Runtime.makeApplication({ Model, init, update, view, subscriptions, resources: Http.layer, container: document.getElementById("root") })
)
