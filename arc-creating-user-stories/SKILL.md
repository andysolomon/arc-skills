---
name: arc-creating-user-stories
description: "Creates development plans with user stories in Gherkin format and creates work items in Linear, GitHub Issues, or Agile Accelerator."
---

# Creating User Stories

Generates implementation-ready stories grouped by epics and creates them in the selected tracker.

## Step 0: Destination Prompt (Always Ask)

Ask:

> Where should I create these stories?
>
> 1. Linear
> 2. GitHub Issues
> 3. Agile Accelerator

If Linear is chosen, ask:
- Team key (required)
- Project key/name (optional)

## Workflow

1. Analyze codebase and identify concrete improvements/features
2. Propose epic/theme grouping to user
3. Assign IDs `W-######` sequentially
4. Create stories in selected destination
5. Verify and return links/IDs

## Story Numbering

Use global sequential `W-######` format.

- GitHub: derive from issue titles
- Agile: derive from `Name` records
- Linear: derive from existing issue titles in selected team/project

## Story Format (Required)

```markdown
## User Story
**ID:** W-000001

As a [user], I want [goal] so that [benefit].

## Acceptance Criteria

### Scenario: [name]
**Given** ...
**When** ...
**Then** ...
**And** ...

## Context
Technical context and affected files.
```

## Label Taxonomy

- Epic: `epic:<name>`
- Priority: `priority:P0|P1|P2`
- Size: `size:S|M|L|XL`

Use same taxonomy across Linear/GitHub where possible for parity.

## Linear Creation Rules

Create Linear issues with:
- title: `[W-XXXXXX] <short title>`
- description: full story body with Gherkin criteria
- team: required
- project: optional
- labels: epic/priority/size

When needed, create one parent planning issue and link child issues in description section (`Blocked by`, `Depends on`, etc.).

## GitHub Creation Rules

- Ensure labels exist (`gh label create ... || true`)
- Create issue via `gh issue create --title ... --body-file ...`
- Add to repo project board when available

## Agile Accelerator Rules

- Create `agf__ADM_Work__c` with subject + details
- Associate sprint/epic if requested

## Quality Rules

- Gherkin acceptance criteria is mandatory for every story.
- No duplicate stories; check tracker first.
- Prefer thin, independently deliverable stories.
- Return created items as a numbered list with direct URLs/IDs.
