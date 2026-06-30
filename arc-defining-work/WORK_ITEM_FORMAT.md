# Work Item Format

## Story numbering

Use sequential IDs: `W-000001`, `W-000002`, etc.

GitHub highest existing number:

```bash
gh issue list --limit 100 --state all --json title --jq '.[].title' | grep -oP 'W-\d+' | sort -r | head -1
```

Agile Accelerator highest existing number:

```bash
sf data query --query "SELECT Name FROM agf__ADM_Work__c ORDER BY Name DESC LIMIT 1" --target-org <org-alias> --json
```

In Agile Accelerator, `Name` is auto-generated; do not set it during creation.

## Gherkin story body

```markdown
## User Story
**ID:** W-XXXXXX

As a [user/developer/maintainer], I want [goal] so that [benefit].

## Acceptance Criteria

### Scenario: [Descriptive scenario name]
**Given** [precondition]
**When** [action]
**Then** [expected outcome]
**And** [additional outcome]

## Context
Concrete technical context referencing files, components, APIs, or constraints.
```

## Labels / metadata

- Epic: `epic: <name>`
- Priority: `P0`, `P1`, `P2`
- Size: `S`, `M`, `L`, `XL`

## Quality rules

- Every scenario should be testable.
- Keep stories independently deliverable.
- Prefer concrete context over generic feature descriptions.
- Mark dependencies and blocked/HITL status explicitly.
