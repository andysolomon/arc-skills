---
name: arc-system-architecture
description: Decides where and how things run - which machine, platform or cloud service each part of a system runs on, how it is reached, what triggers it, where state and secrets live - and draws it as an architecture page, then writes it as code (an Alchemy stack, a compose file, a Tailscale serve, a schedule, manifests) when asked. Use when asked where something should run or be hosted, how to expose, tunnel, schedule or wire services together, to draw or review an architecture or deployment, or to move something to a different platform. Not for building the app itself (arc-web-production), work inside a Salesforce org (arc-salesforce-engineering), or learning system design step by step (arc-system-design).
---

# System architecture

An architecture here is a placement. It records every component, where it runs, how it is reached, what starts it, and where its state and secrets live. Start from what is observed, not from memory. Place each part as low as its needs allow, draw it, and write it as code only when asked to set it up.

This skill owns the wiring between parts: platforms, tunnels, hosts, schedules, clusters, DNS, and the infrastructure code for them. The app inside a part belongs to its own layer: `arc-web-production` for a web app (its deploy guide covers its own Alchemy stack), `arc-salesforce-engineering` for an org.

## Steps

1. **Take the inventory.** Run `bash <skill-dir>/scripts/inventory.sh <repo>`, adding `--machine` when the system runs on this machine. It is read-only. Add what the user tells you, marked as told. Completion: every existing component has where it runs, marked `observed`, `told` or `unknown`.
2. **State the requirements.** For each component, existing or new, write down:
   - reach: me, my devices, a team, or the public;
   - trigger: requests, a schedule, or a queue;
   - lifetime: today, weeks, or must not expire;
   - state: none, per user or room, relational, or files, and who else reads or writes it;
   - runtime: JavaScript on Workers, or something else;
   - secrets, a custom domain, and a cost ceiling.

   Ask only for the answers that would change a placement, through the harness's question dialog. Completion: every requirement is written, and an unknown one says unknown.
3. **Place each component.** Read [references/placement.md](references/placement.md) now. It holds three choices per component: the runs-on ladder, the reached-by options, and the triggers. It also holds the rule for reaching state another component owns. Completion: each component has one sentence naming where it runs, how it is reached and what starts it, and the requirement behind each choice. Nothing sits higher on the ladder than a requirement asks for.
4. **Review it.** Read [references/review.md](references/review.md) and fill its table for each component: what happens when it is down, where its state lives and how it is backed up, where its secrets live, who can reach it, its cost, and how to undo it. Completion: every cell is filled, an unknown one says unknown, and every public surface is listed.
5. **Draw it** on a page by `arc-html-response`'s rules. Its diagram rules load `diagram-design`: use the architecture type for the current state, and the architecture delta type for a proposed change (before and after, with a changes ledger). This is where the look applies, because `arc-html-response` takes it from `arc-design`. Completion:
   - every box is a component from step 1 or one placed in step 3, labelled with where it runs;
   - trust boundaries (internet, edge, tailnet, host, org) are drawn as groups;
   - every arrow is labelled with its protocol and port, or with its binding or trigger name (a Worker binding, a cron schedule);
   - the main request path is the one accent path;
   - an unknown is drawn dashed and labelled unknown.
6. **Write it as code** only when the request is to set it up. Use the tool and the verify command that placement.md gives for each choice. Setup clicked together in a dashboard doesn't count as done. Completion: each verify command passes, and nothing has been applied yet.
7. **Apply only when asked.** Confirm first whenever a step opens a public URL, costs money, or destroys state, and state the undo before confirming. Completion: the reply gives each endpoint, a check run against it (`curl`, an API check), and the undo command.
8. **Report** through `arc-html-response`. The page from step 5 is the report. Put the decision first, then the diagram, then the step 4 review table. A plan or review ends there. When steps 6 or 7 ran, end with `arc-html-response`'s packet. Completion: the page shows the decision, the diagram and the table, and every check in a packet is labelled `PASS`, `FAIL` or `NOT_RUN`.

## Maintaining this skill

After changing `scripts/inventory.sh`, run `bash <skill-dir>/tests/test-inventory.sh`. It builds a fixture repo with one file of each kind and checks the report. It needs no network.
