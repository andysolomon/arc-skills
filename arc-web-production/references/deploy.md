# Deploy to Cloudflare with Alchemy

Read this when the user asks to ship the app or to see it on a real URL. `template/cloudflare/` holds the stack.

## What the stack is

- `cloudflare/alchemy.run.ts`: one Alchemy `Stack` with one `Cloudflare.Worker`. The Worker serves the built web app from `dist/` and binds one `Cloudflare.DurableObject`.
- `cloudflare/worker.ts`: the API. The Durable Object keeps its data in its own SQLite (`ctx.storage.sql`). `POST` is idempotent on the note's id (`INSERT OR IGNORE`), which is the rule the client's retries depend on.
- Web app and API share one origin, so the browser's relative `/api/…` requests need no CORS.

## Run it locally first

```sh
npm run cf:dev        # builds the web app, then runs the Worker on local workerd; no Cloudflare account
```

It prints a `http://localhost:8787` URL (set `PORT` to change it). Check, at minimum:

```sh
curl -s -X POST localhost:8787/api/notes -H 'content-type: application/json' -d '{"id":"k1","text":"hello"}'
curl -s -X POST localhost:8787/api/notes -H 'content-type: application/json' -d '{"id":"k1","text":"hello"}'
curl -s localhost:8787/api/notes      # exactly one note
```

`alchemy dev` writes local state under `cloudflare/.alchemy/`, which is gitignored.

## Deploy

Confirm with the user first: a deploy creates a public URL.

```sh
npm run cf:deploy -- --stage prod     # needs Cloudflare credentials in the environment
npm run cf:destroy -- --stage prod    # removes what this stack created
```

- **Always pass `--stage`.** State is keyed by stack name and stage; without it Alchemy uses a per-user stage name, and two people would deploy two copies.
- **Rename the stack** (`"FoldkitApp"` in `alchemy.run.ts`) per app before the first deploy. Renaming later orphans the old resources.
- **State is local by default** (`Alchemy.localState()`). A deploy from CI or a second machine needs a shared state store; set one up before relying on it.
- **Report** the URL, the three checks above run against it, and the destroy command.

## Before real use

- **Add sign-in.** The template's API is open: anyone with the URL can read and write. Decide who may write, and check it in the Worker, not only in the UI.
- **Bound what users can store.** The template caps a note at 2,000 characters and a list read at 200 rows. Add a rate limit for a public app.
- **One Durable Object is one writer.** `getByName("root")` sends every request to a single object, which is right for a small shared list. For per-user or per-room data, name the object by that user or room.

## What this skill verified

| Check | Result |
|---|---|
| Typecheck of the stack and the Worker | PASS |
| `alchemy dev` on local workerd: save, repeat save with the same id stored once, bad input answers 400, the built web app is served | PASS |
| The web app in headless Chromium against that Worker: add, lost-reply retry, failed save then Retry | PASS |
| `alchemy deploy` to a Cloudflare account | NOT_RUN |
| A shared state store, a custom domain, sign-in | NOT_RUN |
