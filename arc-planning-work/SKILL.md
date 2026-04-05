---
name: arc-planning-work
description: "Creates implementation plans from tracked work items in Linear, GitHub Issues, Agile Accelerator, or PRDs."
---

# Planning Work

Creates detailed implementation plans by reading the tracked work item, analyzing code, and posting plan output back to the source system.

## Destination/Mode Selection

If user does not specify system, ask:

> Where is this work item tracked?
>
> 1. Linear
> 2. GitHub Issues
> 3. Agile Accelerator
> 4. PRD file/doc only

If Linear is selected, ask each run:
- Team key (required)
- Project key/name (optional)

## Workflow (All Modes)

1. Read tracked work item details
2. Read relevant code and architecture context
3. Build ordered task plan (vertical slices preferred)
4. Map tasks to acceptance criteria
5. Post plan back to source

## Plan Format

````markdown
## Implementation Plan

**Story:** [W-XXXXXX] Title
**Branch:** `feat/W-XXXXXX-short-description`

### Analysis
Short summary grounded in actual code.

### Tasks
- [ ] 1. ...
- [ ] 2. ...
- [ ] 3. ...

### Test Strategy
- [ ] Unit
- [ ] Integration/E2E
- [ ] Manual QA

### Acceptance Criteria Mapping
| Scenario | Task(s) | Verification |
|----------|---------|--------------|
| ... | ... | ... |

### Risks & Notes
- ...
````

## Linear Mode

- Fetch issue details from Linear (GraphQL/API tooling)
- Post plan as issue comment or append structured plan section in description
- Keep status tracking in Linear as canonical source

Recommended conventions:
- Keep epic/parent issue for roadmap
- Keep child issues execution-focused
- Use semantic-version/vertical-slice checkpoints in plan comments when relevant

## GitHub Mode

- Read issue: `gh issue view <number> --json title,body,labels`
- Post plan: `gh issue comment <number> --body-file <file>`
- Branch naming: `feat/W-XXXXXX-short-description`

## Agile Accelerator Mode

- Query story fields from `agf__ADM_Work__c`
- Append plan to details and update status if requested

## PRD-to-Plan Mode

- Identify durable architecture decisions first
- Produce thin vertical slices by phase
- Save plan output to `./plans/<feature>.md`

## Rules

- Never plan from assumptions; always read code first.
- Every acceptance criterion maps to at least one task.
- Keep tasks atomic and reviewable.
- This skill plans only; do not implement unless user asks.
