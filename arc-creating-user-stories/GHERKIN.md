# Gherkin Story Reference

Load this when drafting story bodies or reviewing acceptance criteria.

## Story numbering

Every story uses a sequential zero-padded ID:

- `W-000001`, `W-000002`, ...

The ID is prepended to the issue title:

```text
[W-000001] Replace placeholder weather values
```

Before assigning IDs, check the highest existing story number:

```bash
gh issue list --limit 100 --state all --json title --jq '.[].title' | grep -oP 'W-\d+' | sort -r | head -1
```

If no stories exist, start at `W-000001`; otherwise increment from the highest.

## Issue body template

```markdown
## User Story
**ID:** W-000001

As a [user/developer/maintainer], I want [goal] so that [benefit].

## Acceptance Criteria

### Scenario: [Descriptive scenario name]
**Given** [precondition]
**When** [action]
**Then** [expected outcome]
**And** [additional outcome]

### Scenario: [Another scenario]
**Given** [precondition]
**When** [action]
**Then** [expected outcome]
**But** [negative assertion]

## Context
Brief technical context referencing specific files, APIs, behaviors, or design constraints.
```

## Gherkin rules

- Each acceptance criterion is a `Scenario` with Given/When/Then steps.
- Use `And` for additional steps within a Given/When/Then section.
- Use `But` for negative assertions.
- Scenario names should be descriptive and testable.
- Keep steps atomic: one action or assertion per line.
- Prefer concrete values and observable behavior over vague language.
- Every scenario should map to a likely unit, integration, E2E, or manual verification path.

## Example

```markdown
## User Story
**ID:** W-000015

As a mobile user, I want the weather panel to fit naturally on small screens so that I can browse comfortably.

## Acceptance Criteria

### Scenario: Panel renders as full-height sheet on mobile
**Given** the viewport width is 375px or less
**When** I open a city's weather panel
**Then** the panel spans the full viewport height
**And** the close button is within thumb reach

### Scenario: Charts stack vertically without horizontal scroll
**Given** I am viewing the dashboard on a mobile device
**When** the charts section renders
**Then** all charts stack in a single column
**And** no horizontal scrollbar appears

## Context
Panel component: `src/components/WeatherPanel.tsx`
```
