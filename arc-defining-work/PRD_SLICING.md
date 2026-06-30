# PRD Slicing Reference

Load this when the source is a PRD and the user wants new work items.

## Tracer-bullet slicing

Each slice should deliver a narrow but complete path through the relevant layers: schema, API, UI, tests, docs, and deployment/config where applicable.

Rules:

- A completed slice is demoable or verifiable on its own.
- Prefer many thin slices over a few thick ones.
- Avoid horizontal slices such as "build all database tables" unless they unlock no user-visible path and are truly foundational.

## Slice classification

- **AFK**: can be implemented and merged without human interaction. Prefer AFK where possible.
- **HITL**: requires human interaction such as an architectural decision, compliance review, or design approval.

## Approval quiz

Before creating work items, present each slice with:

- Title
- Type: AFK / HITL
- Blocked by
- User stories or PRD sections covered
- Acceptance criteria

Ask:

- Is the granularity right?
- Are dependencies correct?
- Should slices be merged or split?
- Are HITL/AFK labels correct?

Create work items only after approval unless the user explicitly asked to skip review.
