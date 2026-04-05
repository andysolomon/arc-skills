---
name: arc-planning-github-issues
description: "Creates implementation plans for GitHub issues before coding begins. Use when asked to plan work, break down an issue, create a task list, or prepare to implement a story."
---

# Planning GitHub Issues

Creates detailed implementation plans for GitHub issues by analyzing the codebase, breaking work into ordered tasks, and posting the plan as a comment on the issue.

## Workflow

1. **Read the issue** using `gh issue view <number>`
2. **Analyze the codebase** — read all files referenced in the issue's Context section and any related files
3. **Create the plan** with ordered tasks, file changes, and test strategy
4. **Post the plan** as a comment on the issue using `gh issue comment`
5. **Move the issue** to "In Progress" on the project board if applicable

## Plan Format

Every plan must follow this structure posted as an issue comment:

````markdown
## Implementation Plan

**Story:** [W-XXXXXX] Title
**Branch:** `feat/W-XXXXXX-short-description`

### Analysis

Brief summary of what needs to change and why, based on reading the actual code.

### Tasks

- [ ] **1. [Description of first task]**
  - Files: `path/to/file.ts`
  - Details: What specifically to change and how

- [ ] **2. [Description of second task]**
  - Files: `path/to/file.ts`, `path/to/other.ts`
  - Details: What specifically to change and how

- [ ] **3. [Description of third task]**
  - Files: `path/to/file.ts`
  - Details: What specifically to change and how

### Test Strategy

- [ ] **Unit tests:** What to test and where
- [ ] **E2E tests:** What scenarios to cover
- [ ] **Manual QA:** What to verify visually or interactively

### Acceptance Criteria Mapping

| Scenario | Task(s) | How Verified |
|----------|---------|--------------|
| Scenario name from issue | #1, #2 | Unit test / E2E / Manual |
| Another scenario | #3 | Unit test |

### Risks & Notes

- Any edge cases, dependencies, or decisions to flag
````

## Commands

### Read the issue
```bash
gh issue view <number> --json title,body,labels
```

### Post the plan as a comment
```bash
gh issue comment <number> --body "<plan markdown>"
```

### Create a feature branch
```bash
git checkout -b feat/W-XXXXXX-short-description
```

### Move issue to In Progress (if project board configured)
```bash
# Get the project item ID and status field
gh project item-list <project-number> --owner <owner> --format json \
  --jq '.items[] | select(.content.number == <issue-number>)'
```

## Guidelines

- **Read before planning**: Always read the actual source files before creating a plan. Never plan based on assumptions.
- **Atomic tasks**: Each task should be a single, reviewable change. Avoid tasks that touch too many files.
- **Order matters**: Tasks should be ordered so each builds on the previous. Data/type changes before UI, utilities before consumers.
- **Map to acceptance criteria**: Every Gherkin scenario from the issue must map to at least one task and a verification method.
- **Branch naming**: Always use `feat/W-XXXXXX-short-description` format.
- **PR convention**: When creating the pull request, include `Closes #<number>` in the PR body so the issue auto-closes on merge.
- **Test-aware**: Include specific test file paths and test names where possible.
- **No implementation**: This skill creates the plan only. Do not start coding until the user approves the plan.
- **Post to issue**: Always post the plan as a GitHub issue comment so it's visible to the team.
