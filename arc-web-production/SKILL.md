---
name: arc-web-production
description: Builds web apps that last, on the Effect stack - Foldkit (The Elm Architecture on Effect v4, no React), Vite, tests that run without a browser, and an Alchemy stack that deploys to Cloudflare. Use when asked to build, extend, restyle, test or ship a real web app, dashboard or frontend; when a Lakebed prototype has outgrown Lakebed; or to render app data as a script-free page. Not for one-off answers and reports (arc-html-response), throwaway shared-state prototypes (Lakebed, through arc-html-response), or screens inside a Salesforce org.
---

# Web production

A web app here is a Foldkit program: one Model, Messages as facts, a pure `update`, a pure `view`, and side effects as Commands. [template/](template) is a small working app in that shape: a notes list with its tests, a mock API, a static render, a style lint, an API check and a Cloudflare stack. Start from it; don't start from a blank folder or from React.

## Steps

1. **Pick the rung.** Choose the lowest one that serves the request, and say which in one line.
   - Nobody types into it: render a pure view once to a page with no script (`npm run static`), then publish it by `arc-html-response`'s rules.
   - People type into it, but it is a throwaway or a quick try: a Lakebed capsule. Follow `arc-html-response`'s `lakebed.md`, not this skill.
   - It must last, needs npm packages, or needs its own domain: a Foldkit app. Continue below.

   Completion: the rung and its reason are stated.
2. **Start from a passing baseline.**
   - **New app:** `cp -R <skill-dir>/template/. <app-dir>` (the `/.` keeps `.gitignore`), then rename: `name` in `package.json`, `<title>` in `index.html`, the stack name `"FoldkitApp"` in `cloudflare/alchemy.run.ts`, and the `Notes` class and `NOTES` binding in `cloudflare/worker.ts` and `alchemy.run.ts`.
   - **Existing app** in this shape: don't copy anything.
   - Then `npm ci` (or `npm install` for an existing app without a lockfile) and `npm run check`. The install is about 650 MB, mostly workerd and Alchemy. npm may warn that `workerd`'s install script is "not yet covered by allowScripts"; that is expected and harmless.

   Completion: `npm run check` passes before you change anything. If it doesn't, stop and report that.
3. **A restyle stops here and jumps to step 7.** A restyle changes only `src/tokens.css` and `src/styles.css`. Screen text and behaviour are a separate request. Completion: the reply says the request is a restyle, or that it isn't.
4. **Design the states before the screen.** Write the Model and Messages first. Read [references/foldkit-rules.md](references/foldkit-rules.md) now: it holds the rules for Model, `update`, Commands, `view`, tests, and the pitfalls. Completion: every remote value is an `AsyncData`, every write the user can start has a phase union and an idempotency key, and every Message is a past-tense fact.
5. **Write the API.** Change `cloudflare/worker.ts` and mirror the change in `scripts/mock-api.ts`; the two must keep the same contract. Every write is idempotent on its key: a repeat stores nothing new and answers 200. Validate input and answer 400. Update `scripts/api-check.ts` for the new routes, and when you rename the Model, rename `scripts/render-static.ts`'s import and view too (or delete that file and the `static` script if the app will never need a static page). Completion: `npm run api:check -- <url>` passes against the mock (`npm run mock`) and against the Worker (`npm run cf:dev`).
6. **Write `update`, the Commands and `view`.** Completion: `update` reads no clock, randomness or network; every Command turns its failures into a Message; loading, empty, failure and stale each render something specific; every control has a label; lists are keyed by a Model identity.
7. **Apply the look.** Read `arc-design`'s "The look", "Taste rules" and "Motion" sections and follow them; don't run its routing steps, which send you back here. `src/tokens.css` is a byte-for-byte copy of `arc-design/tokens.css`; app-specific extra tokens go at the top of `src/styles.css`, never in the copy. Each animated state gets its own `@keyframes` name: a class change restarts an animation only when its name changes, so one shared name plays once and never again. Completion: `npm run lint:styles` passes (tokens only, motion guarded, one keyframes name per state), and `node <arc-design>/scripts/check-tokens.mjs src/tokens.css` passes.
8. **Test without a browser.** Story for `update`, Scene for `view`, a direct `update` call for anything with two requests in flight, and a Command test with a stub client for each new Command. Add tests for each new write: the key comes from the Model, a double submit sends nothing, a retry reuses the key. Completion: `npm run check` passes, and one deliberately wrong expectation, in a temporary copy of a test file, was seen to fail. For a restyle, `npm run check` only proves behaviour didn't change; step 9 proves the look.
9. **Look at it.** Run the app at 390 px and at desktop width, in light and dark, and put it in every state. Use any browser you have (headless Chromium driven by Playwright works). Free ports first (`ss -ltn`); the servers read `PORT` (API, default 8787), `WEB_PORT` (Vite, default 5173) and `API_URL` (where Vite proxies `/api`).
   - Full stack: `PORT=<port> npm run cf:dev` serves the built app and the real Worker on one origin.
   - Each state: `npm run mock` with `npm run dev`, and the mock's switches: `DELAY_MS=1500` holds Loading and Saving on screen, `FAIL_SAVES=1` makes every save end as "not saved" with Retry, `FAIL_FIRST_SAVE=1` loses one reply, and stopping the mock shows the stale state.
   - Stop `cf:dev` with Ctrl-C (SIGINT) and wait until its port is closed: it runs workerd in a separate process, so killing npm alone leaves the port held. Its local data lives in `cloudflare/.alchemy/`; delete that folder to reset.

   Completion: no sideways scroll at 390 px and every state looks right, or the reply says `NOT_RUN` for the browser check.
10. **Deploy only when asked.** A deploy creates a public URL, so confirm first, and say before confirming that the template's API has no sign-in: anyone with the URL can read and write. Follow [references/deploy.md](references/deploy.md). Completion: `npm run api:check -- <deployed-url>` passes, and the reply gives the URL and the destroy command.
11. **Report** through `arc-html-response`, ending with its packet. Completion: every check is labelled `PASS`, `FAIL` or `NOT_RUN`.

## Pins

`package-lock.json` pins every version; install with `npm ci` and commit the lockfile. `package.json` pins `foldkit` 0.171.0 exactly, `effect` to `~4.1.4`, `@foldkit/vite-plugin` 0.29.1 and `alchemy` 2.0.0-beta.87. Foldkit and Alchemy are pre-1.0, and Foldkit's peer range is `effect ~4.1`. Don't raise a pin as a side effect of other work. Effect here is v4: most examples online are v3 and won't compile, so read `node_modules/effect/ai-docs` instead of answering from memory. Foldkit's API is in its type files: `node_modules/foldkit/dist/**/*.d.ts` (for example `dist/test/scene.d.ts`).

## Maintaining this skill

After changing the template, run `bash <skill-dir>/tests/test-template.sh`. It copies the template to a temp folder, runs `npm ci`, the checks, the build and the static render, lints the static page, and runs the API check against the mock. It needs the network.
