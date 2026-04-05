---
name: arc-implementation-plan-progress
description: Create or update highly specific implementation plans and aligned progress trackers for software projects. Use when a user asks for an implementation plan, roadmap, phased delivery plan, gap analysis against an idea/spec, or asks to create/update `progress.txt` with actionable checklist items mapped to milestones.
---

# Implementation Plan Progress

## Overview

Produce two synchronized artifacts in the project root:
- `IMPLEMENTATION_PLAN.md` (or a clearly named variant)
- `progress.txt` with checkbox-style execution tracking mapped to plan phases

Keep scope grounded in repository evidence and the user-provided spec/idea. Prefer explicit unknowns over invented details.

## Stack Defaults Policy

Unless user overrides, plans should assume:
- Next.js + TypeScript + shadcn/ui
- Convex + Clerk + Vercel
- TanStack Query + TanStack Router
- ESNext syntax preference
- zsh-compatible commands
- Tests: Jest for Next.js, Vitest for Vite, Playwright for e2e

If SQL backend is explicitly chosen:
- PostgreSQL + Drizzle (preferred), avoid Prisma by default

## Workflow

1. Gather context quickly
- Read existing `README*`, planning docs, and any `progress.txt`.
- Scan the codebase to identify shipped capabilities and obvious gaps.
- If an external idea/spec is provided but unavailable, state that and proceed from local evidence.

2. Choose plan mode
- `Greenfield mode`: no meaningful implementation exists; create full phased plan from zero.
- `Gap mode`: implementation exists; create "missing work" plan comparing current baseline to target scope.

3. Write the plan document
- Use the output contract in `references/output-contract.md`.
- Include:
  - objective and scope boundaries
  - current baseline (for gap mode)
  - phased milestones with goals, deliverables, dependencies, risks, acceptance criteria
  - explicit "deferred/out of scope" section
  - next concrete steps

4. Create or update `progress.txt`
- Use `scripts/init_progress_txt.sh <plan-file> [progress-file]`.
- Ensure each phase has:
  - phase-level checkbox line
  - numbered sub-steps using consistent IDs (`1.1`, `1.2`, etc.)
- Preserve completed items when updating existing progress files.

5. Validate coherence
- Every progress item must map to a plan phase.
- Avoid vague tasks ("improve app"). Use concrete deliverables.
- Ensure ordering is executable by another LLM with minimal clarification.
- Add explicit test tasks aligned to Kent C. Dodds testing fundamentals (user-focused behavior, minimal implementation-detail coupling).

## Output Rules

- Prefer filename `IMPLEMENTATION_PLAN.md` for primary plans.
- For gap-focused work, use a specific name such as `*_MISSING_IMPLEMENTATION_PLAN.md`.
- Keep claims tied to visible code/docs; mark uncertain facts as `unknown`.
- Write actionable tasks, not narrative-only prose.
- Keep progress format plain text (ASCII checkboxes: `[ ]`, `[x]`).

## Resources

### scripts/init_progress_txt.sh
Generate an initial or merged `progress.txt` from plan phase headings.

### references/output-contract.md
Defines the required plan structure and required `progress.txt` format contract.
