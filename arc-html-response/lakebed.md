# Building a Lakebed app

Read this when a request needs state a page can't hold: step 1 of [SKILL.md](SKILL.md) says which requests those are. A deploy creates a public URL, so when the user asked for a page and it turned out to need state, confirm before building. Everything here comes from building and deploying four real Lakebed apps: a lunch vote, a two-judge scorecard, a story inbox with a secret-protected pull API, and a live game-day play caller.

## Where the code goes

- **A scratch folder by default.** Only put the app in a repo when the user asks.
- **Inside a repo, keep it out of the repo's build.** A capsule is a separate app with its own imports. Exclude its folder from `tsconfig.json`, the linter, the test runner and Tailwind's source scan (`@source not "../<folder>"`). Then run the repo's typecheck, lint and tests before and after to prove nothing changed.
- **Never commit `.lakebed/` or `.env.lakebed.server`.** The generated `.gitignore` covers `.lakebed/`; add the env file if it's missing.

## Build

1. `npx --yes lakebed@<version> new <dir>`, pinned to a version. Read the generated `AGENTS.md`, then `https://lakebed.dev/agents.md`, which is newer on loading states: render nothing while a query is `undefined`, and never `?? []` before rendering a list.
2. Shape the data around one write per user action:
   - one vote or score per person: look it up through an index with `.first()`, then `update(id, …)` or `insert(…)`;
   - totals: `count()` on an index, not reading every row;
   - `insert()` returns the row, so use `row.id`.
3. **Guests by default** (`auth: { requireSignIn: false }`). The local test identities (`?lakebed_guest=<name>`) are guests and can't pass `requireSignIn: true`, so a sign-in-only app can't be tested headlessly. For anything that accepts input from a link, add caps instead (per person and in total) with clear error messages.
4. **Enforce roles on the server.** Store the owner's `userId` and check it inside the mutation. Hiding a button is not a permission check.
5. **Secrets and outbound fetch need a claimed deploy.** An endpoint that needs `ctx.env` must fail closed: answer 503 with a message saying to claim the deploy and set the secret, and never return data without it. Compare `Authorization: Bearer <secret>` yourself; that header belongs to the app.
6. Endpoints live under `/api/...`, never on a path a client route uses.
7. `npx lakebed build` doesn't typecheck. Run `tsc` against the lakebed types when the app has real logic; it caught a bug in two of the four apps.

## Test

- Run `npx lakebed dev --port <n>` in the background, then drive it with a headless browser, with one browser context per person. Locally, give each context `?lakebed_guest=<name>`. On a live URL, separate contexts are already separate guests.
- Test the thing that makes it an app: person A acts, person B sees it, B changes something, A sees that. Measure live-update latency when it matters.
- Call each mutation with bad input to prove the server rejects it.
- `npx lakebed db dump --port <n>` confirms the stored rows.
- Hosted endpoints refuse a request that carries a guest cookie but doesn't come from the app page (403). Test endpoints with a cookie-less client.
- Live tests leave rows behind. Test fully on the dev server first, keep live tests to one short pass, and give the app a way to delete test data if it will be kept.
- Stop the dev server when done.

## Deploy and hand over

- `npx lakebed deploy` creates an anonymous preview that expires after a week. Report the URL and the exact expiry.
- **Claiming needs the user** (`npx lakebed claim`). The claim token lives only in the capsule's `.lakebed/` folder, so never delete that folder, or the worktree holding it, before the user claims.
- After a claim, every deploy copies `.env.lakebed.server` to the hosted app. Never leave a test secret in that file.
- Write the page about it as usual: why it's an app and not a page, a link to the app, and a packet with the URL, the expiry, the tests run, any test data left on the live app, and the steps only the user can take.
- Keep that write-up on Postplan and link the app with an ordinary link. A Postplan page can't embed or call it (no iframes, no fetch).

## When to move to Cloudflare

When the app must not expire or must be production-ready, needs a custom domain or npm packages, or would pass Lakebed's free limits: 10,000 requests and 1,000 writes a day per deploy, and 1 MiB of stored data. Move it to `arc-web-production`: a Foldkit app on Cloudflare (a Worker with static assets, Durable Objects for state, an Alchemy stack).

## Example

A team lunch vote with a live tally, built and tested this way: <https://cac20267xx98.postplan.dev>.
