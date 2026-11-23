/**
 * Browser entry: boot the Foldkit Runtime. Everything else imports and tests without a DOM.
 * `resources: Http.layer` gives every Command a fetch-backed HttpClient. Requests use
 * relative URLs, so they go to whatever served this page.
 *
 * arc-3d changes two things from the template's entry.ts: the program comes from app.ts
 * (the notes program plus the scene), and the scene's stylesheet is imported here.
 */
import { Http, Runtime } from "foldkit"
import { init, Model, subscriptions, update, view } from "./app.ts"
import "./scene/scene.css"

Runtime.run(
  Runtime.makeApplication({ Model, init, update, view, subscriptions, resources: Http.layer, container: document.getElementById("root") })
)
