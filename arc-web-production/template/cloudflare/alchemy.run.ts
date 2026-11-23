/**
 * The app's infrastructure as an Alchemy stack: one Worker that hosts the `Notes` Durable
 * Object and serves the built web app from ../dist.
 *
 *   npm run cf:dev       run it locally on workerd, no Cloudflare account needed
 *   npm run cf:deploy    build the web app, then deploy (needs Cloudflare credentials)
 *   npm run cf:destroy   remove everything this stack created
 */
import * as Cloudflare from "@alchemy.run/cloudflare"
import * as Alchemy from "alchemy"
import * as Effect from "effect/Effect"
import { existsSync } from "node:fs"
import { join } from "node:path"

const here = import.meta.dirname
const web = join(here, "..", "dist")

export default Alchemy.Stack(
  "FoldkitApp", // rename per app: state is keyed by this name and the stage
  {
    providers: Cloudflare.providers(),
    state: Alchemy.localState() // state rows under ./.alchemy/state/ (gitignored)
  },
  Effect.gen(function*() {
    const worker = yield* Cloudflare.Worker("Api", {
      main: join(here, "worker.ts"),
      compatibility: { flags: ["nodejs_compat"], date: "2026-10-01" },
      // A request that matches a built file is answered from dist. Everything else reaches the Worker.
      ...(existsSync(join(web, "index.html")) ? { assets: { directory: web } } : {}),
      env: { NOTES: Cloudflare.DurableObject("Notes") }, // SQLite-backed
      dev: { host: "127.0.0.1", port: Number(process.env.PORT ?? 8787) }
    })
    return { url: worker.url }
  })
)
