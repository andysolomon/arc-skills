# Architecture review

Read at step 4. Fill one row per component. Write an unknown as `unknown`, never as a guess. The table goes on the page under the diagram.

| Component | Runs on | Down means | State and backup | Secrets | Reached by | Cost | Undo |
|---|---|---|---|---|---|---|---|
| api | Cloudflare Worker | the app can't save or load | Durable Object SQLite; no backup yet | `API_TOKEN` as an Alchemy secret | public, no sign-in | Workers free plan; nearest limit: requests a day (from the pricing page) | `alchemy destroy --stage prod` |

## Down means

Say what a user sees, not just what failed: "the list loads from cache, saves fail with Retry". Call out a single point of failure. You don't have to remove it; the user has to know it's there.

## State and backup

- Name the store and where its data physically lives (which host, which service).
- Give the backup command, or write "no backup" so it reads as a gap rather than an oversight. Common ones:
  - D1: `wrangler d1 export`.
  - A compose volume: `docker run --rm -v <vol>:/data -v "$PWD":/out alpine tar czf /out/<vol>.tgz -C /data .`
  - A Durable Object: an export endpoint the app provides.
- Data that is lost when the host restarts (`/tmp`, a container without a volume) is not state; say so.

## Secrets

- Secrets live in the platform's secret store (an Alchemy secret, a Worker secret, a CI secret) or in an env file that git ignores. Never in the repo, an image or a URL.
- Check two things and read every hit:
  - files that usually hold secrets: `git ls-files | grep -E '(^|/)\.env($|\.)|\.(pem|key|p12)$'`. An `.env.example` with placeholders is fine.
  - values that look like secrets: `git grep -niIE "(api[_-]?key|secret|token|password)[\"']?\s*[:=]\s*[\"']?[A-Za-z0-9_/+=-]{16,}"`.

  Completion for this cell: every hit is a placeholder or has been moved out, and the reply says which.

## Reached by

- List every public surface: URL, port, and what can be done there without signing in.
- No admin port (database, dashboard, SSH, metrics) is public (placement.md, Reached by).
- Hiding a button is not access control. Writes are checked on the server.

## Cost

- Write down the plan in use, the free limit closest to being hit, and what the first paid step costs. Get these from the provider's current pricing page. If it can't be checked, write unknown.

## Undo

- One command per component that removes what was created, plus anything it leaves behind (volumes, DNS records, a claimed Lakebed capsule).
- Mark undo commands that delete data. Each needs its own confirmation before running.
