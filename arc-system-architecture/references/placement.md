# Placement

Read at step 3. Each component gets three choices: where it **runs**, how it is **reached**, and what **starts** it. Go up the runs-on ladder only when a requirement from step 2 needs it, and name that requirement.

A Salesforce org is a place of its own: anything that runs inside one goes to `arc-salesforce-engineering`. Something outside it reads org data through a JWT bearer flow (`arc-sf-jwt-bearer`).

## Runs on

| Rung | Fits when | Lasts |
|---|---|---|
| 0. A page | Nothing needs to run: an answer, a report | yes |
| 1. Local process | Only you, on this machine, while you work | while running |
| 2. Lakebed | Shared state for a team or the public, a quick try | a week unless claimed |
| 3. Cloudflare | Must last, JavaScript (or Python Workers) runtime, request-sized work | yes |
| 4. CI runner | A scheduled job with no state of its own and no inbound traffic | yes, while the schedule runs |
| 5. Container | A non-JavaScript runtime, a native binary, a long-running process, a GPU | on a host: while the host is up; on Cloudflare: yes |
| 6. Kubernetes | Several services on a cluster that already exists | yes |

### 0. A page

An answer, a review or a report is a page, not a running system: `arc-html-response`. Undo: unpublish it.

### 1. Local process

Bind to `127.0.0.1`, never `0.0.0.0`, and pick a free port (`ss -ltn`). It fits development only: if someone else needs it, move up. Undo: stop the process and check that its port is closed.

### 2. Lakebed

A shared-state app that may expire. `arc-html-response`'s `lakebed.md` is the build, test and hand-over guide.

Limits:
- an unclaimed deploy expires after a week;
- the free tier allows 10,000 requests and 1,000 writes a day per deploy, and 1 MiB of stored data.

Move to rung 3 when it must not expire, must be production-ready, needs a custom domain or npm packages, or would pass those limits.

### 3. Cloudflare

A Worker serves the app and its static assets from one origin. Pick the service by the kind of state:

| State | Service |
|---|---|
| Per user, room or document, with coordination | Durable Objects (SQLite storage) |
| Relational, across all users | D1 |
| Files and blobs | R2 |
| Read-mostly configuration | KV |

- Write it as an Alchemy stack (`alchemy.run.ts`). For a web app, `arc-web-production` builds the app and owns its stack. This skill decides only what the stack contains and what sits around it.
- CPU time per request is limited, and much lower on the free plan. Python Workers exist, but support for packages is limited. Check both on Cloudflare's docs rather than quoting them from memory. A job past those limits goes to rung 4 or 5.
- Verify: `alchemy dev`. Undo: `alchemy destroy` with the same `--stage` used to deploy.

### 4. CI runner

A scheduled job that fetches, computes and writes somewhere else, with nothing reaching in, can run on the repo's CI (a GitHub Actions `schedule:` or a GitLab pipeline schedule through `arc-gitlab-glab`). There is no host to keep up.
- Secrets are CI secrets.
- Runs are best-effort on time (minutes late is normal), and minutes are limited on private repos.
- Verify: `actionlint` when it is installed; otherwise read the workflow, and after it is pushed (when asked), start one run by hand (`workflow_dispatch`).
- Undo: delete the workflow, or disable it with `gh workflow disable`.

### 5. Container

- **Cloudflare Containers**, started from a Worker (by a request, or by the Worker's Cron Trigger), when the rest of the system is on Cloudflare. Check its current status and limits before choosing it.
- **Docker Compose on a host you already run** otherwise. Every published port binds to `127.0.0.1` (`"127.0.0.1:8080:8080"`). Use named volumes for state, each with a backup command (see review.md).
- Verify: `docker compose config`. Undo: `docker compose down` keeps the volumes. `down -v` deletes data and needs its own confirmation.

### 6. Kubernetes

Only when a cluster already exists and several services need scheduling, scaling or rolling deploys. Never bring in a cluster for one service. A local `kind` cluster is for trying manifests, not for hosting.
- Keep the manifests in the repo, or use a Helm chart when the project already uses Helm.
- Verify: `kubectl apply --dry-run=client` always, and `--dry-run=server` when the cluster may be contacted.
- Undo: `kubectl delete -f <manifests>`, after listing what it deletes, including PersistentVolumeClaims.

## Reached by

| Option | Reach | How | Undo |
|---|---|---|---|
| Nothing | none | A scheduled job or a queue consumer has no inbound route; draw none | none |
| Localhost | this machine | Bind `127.0.0.1` | stop it |
| Tailnet | your devices | `tailscale serve --bg --https=<port> http://127.0.0.1:<local-port>` | `tailscale serve --https=<port> off` |
| Platform URL | public | The `workers.dev` or Lakebed URL, or a custom domain on the platform | the platform's destroy |
| Cloudflare Tunnel | public, from a host | `cloudflared tunnel` to a hostname on a Cloudflare zone, with no open router port | delete the tunnel and its DNS record |

- **Tailnet:**
  - read `tailscale serve status` first, because a port already served is taken (443 often is);
  - report the URL `https://<machine>.<tailnet>.ts.net:<port>` from that output, not one you assemble yourself;
  - a dev server with a host check needs `.ts.net` allowed (Vite: `server.allowedHosts` and `preview.allowedHosts`).
- **`tailscale funnel`** makes a tailnet service public. Use it only when the user asks for exactly that.
- **Admin ports** are reached by localhost or tailnet only (databases, dashboards, SSH, metrics).

## Started by

| Trigger | Where it runs | Tool |
|---|---|---|
| Requests | rungs 1, 2, 3, 5, 6 | the platform |
| A schedule, JavaScript, short | Cloudflare | a Cron Trigger on the Worker, in the Alchemy stack |
| A schedule, any runtime, no host | CI runner | a GitHub Actions `schedule:` |
| A schedule, on a host you run | Container or host | a systemd timer (verify: `systemd-analyze verify <unit>`), or a compose service started by it |
| A schedule, on a cluster | Kubernetes | a CronJob |
| A queue | Cloudflare | a Queue consumer Worker |

Every scheduled job is safe to run twice: a retry or an overlapping run must not double-write. Record when it last succeeded where a person can see it.

## Reaching state another component owns

- One component owns each store and its schema. Another component writes through the owner's API, not around it. For a Durable Object, that means a Worker route, because nothing outside the Worker can reach a Durable Object.
- That route checks a secret (`Authorization: Bearer <token>`, with the token as a secret on both sides). It is idempotent on a key the caller sends, and it rejects bad input with 400.
- Going straight to the store (D1's HTTP API, a database port over the tailnet) is the exception. When you choose it, say why, and give the caller an account limited to what it writes.
- Draw that route as its own arrow, labelled with the path.

## Infrastructure code

- One tool owns each resource. Use Alchemy for Cloudflare. Use Terraform only when the project already uses it, or for a provider Alchemy lacks (verify: `terraform init -backend=false && terraform validate`, then `terraform plan`). Never manage one resource with two tools.
- Keep that tool's state somewhere a second machine can reach before relying on it from CI.

## Not on the ladder

Vercel isn't used for new work. An existing Vercel deploy, such as the portfolio, stays with `arc-project-deploy-portfolio-sync`.
