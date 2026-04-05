---
name: arc-ideabrowser-openclaw-flow
description: Extract startup idea details from IdeaBrowser and produce deterministic scaffold specs for implementation plans and progress tracking. Playwright CLI is primary; OpenClaw is fallback.
metadata:
  short-description: Crawl IdeaBrowser pages and generate scaffold-ready extraction
---

# IdeaBrowser Crawl + Scaffold Flow

Use this skill for end-to-end **read/extract/plan** workflows from IdeaBrowser.

Default boundary: **safe-by-default**.
- Do not write files, commit, push, or deploy unless the user explicitly asks.
- If blocked by auth/checkpoint, pause and give minimal remediation steps.

## Preferred Tooling

1. Primary: `playwright-cli` with extension bridge to existing Chrome session.
2. Secondary fallback: OpenClaw (`openclaw browser ...`) when Playwright bridge is unavailable.

## Stack Profile Defaults For Scaffold Specs

Default profile for generated scaffold specs:
- Framework: Next.js + TypeScript + shadcn/ui
- Data/Auth/Deploy: Convex + Clerk + Vercel
- TanStack: TanStack Query + TanStack Router
- Testing: Jest (Next.js), Playwright (e2e)
- Syntax/shell: ESNext-first and zsh-compatible commands

Optional profile (`postgres-sql-mode`) when user asks:
- Database: PostgreSQL
- ORM: Drizzle (preferred), avoid Prisma unless explicitly requested

## Prerequisites

- `playwright-cli` installed and available.
- Playwright MCP Bridge extension installed in Chrome.
- If needed, set token in environment:
  - `PLAYWRIGHT_MCP_EXTENSION_TOKEN=<token>`

## Workflow

1. Verify browser connectivity (Playwright-first)
- `playwright-cli list`
- If no browser open:
  - `playwright-cli open --extension https://www.ideabrowser.com/idea/<slug>`
- If extension mode cannot attach, use `--headed --extension` once for approval/tab selection.

2. Detect target idea
- Use explicit target when provided (`slug` or full URL).
- If missing, infer slug from current URL/title/snapshot.

3. Crawl core pages
- `main`
- `value-ladder`
- `why-now`
- `proof-signals`
- `market-gap`
- `execution-plan`
- `value-equation`
- `value-matrix`
- `acp`
- `keywords`
- `feasibility-score`
- `problem-score`
- `opportunity`
- `opportunity-score` (compat fallback only)

4. Extract normalized fields
- slug/id
- title
- core problem
- audience/market
- offer/value ladder
- why-now
- proof/signals
- market-gap
- execution-plan
- frameworks (value equation/matrix/acp)
- scoring pages
- top keywords

5. Produce deterministic output sections
- `Detected Idea`
- `Subpage Coverage` (include explicit crawled/missing/blocked list)
- `Structured Extraction`
- `Scaffold Spec`
- `Commands To Execute (on approval)`
- `Risks / Missing Fields`

## Resilient Mode

If crawling is unstable:

1. Playwright CLI retry mode
- Reopen session: `playwright-cli close-all && playwright-cli open --extension <idea-url>`
- Retry per-page with `goto` + `snapshot`.

2. Manual assist mode
- Ask user to load one subpage.
- Snapshot immediately after `loaded`.

3. OpenClaw fallback
- Use OpenClaw only when Playwright extension bridge is blocked/unavailable.

## Scaffold Spec Template

Provide (as content unless user asks to write files):
- repo slug recommendation
- stack profile selected (`next-convex-clerk-shadcn` by default)
- README summary block
- `IMPLEMENTATION_PLAN.md` phase outline
- `progress.txt` starter entries
- optional command checklist for scaffold/validate/git/deploy

## Failure Handling

If extraction fails, output only:
1. blocker
2. minimal user action
3. exact next command

## Helpers

- `scripts/crawl_idea_subpages_playwright.sh [target] [snap_limit]`
- `scripts/crawl_idea_subpages.sh [target] [snap_limit]` (OpenClaw fallback)
- `scripts/extract_idea_fields.sh [target] [limit]`
- `scripts/propose_repo_name.sh`

Use helper scripts for consistency and deterministic logs.
