---
name: arc-project-deploy-portfolio-sync
description: Deploy a project to Vercel and add/update its case-study presence on andrewsolomon.dev (project page plus homepage card), then redeploy the portfolio site and verify links.
metadata:
  short-description: Deploy app and sync portfolio entry
---

# Project Deploy + Portfolio Sync

Use this skill when the user says a project is finished and wants it deployed and visible on `andrewsolomon.dev`.

## Workflow

1. Verify project repo context
- Confirm git branch and local changes.
- Run lint/build/tests in app repo using project stack defaults.
- Identify or create Vercel project.

2. Deploy project app
- Run production deploy from the app repo.
- Capture deployment URL and alias URL.

3. Sync portfolio content
- In `andrewsolomon.dev`, ensure a dedicated project page exists under `projects/`.
- Ensure homepage `index.html` has a card linking to that page.
- Include the live demo URL on the case-study page.
- Do not include unnecessary technology-explainer text if user requests concise portfolio copy.

4. Deploy and verify portfolio
- Deploy `andrewsolomon.dev` to production.
- Verify homepage card + project page + live demo link are reachable.

5. Commit/push (on user request)
- Commit website changes and push `main`.

## Deterministic Output Sections
Always return:
1. `Project Deploy Status`
2. `Portfolio Sync Status`
3. `Live URLs`
4. `Findings / Risks`
5. `Next Commands`

## Stack Interop Notes
- Integrates with shared Clerk and Vercel skills when auth/deploy environment checks are needed.
- Keep deployment commands zsh-compatible.

## Conventions
- Keep case-study pages lightweight and practical.
- Prefer existing style/structure from other pages in `andrewsolomon.dev/projects/`.
- Never remove existing portfolio cards unless user asks.

## Helpers
- `scripts/project_status_check.sh` for app-repo preflight
- `scripts/portfolio_entry_check.sh` for andrewsolomon.dev link presence checks
