---
name: arc-defining-work
description: New work-item creation for Agile Accelerator or GitHub Issues. Use when asked to create stories, build a backlog, define work from codebase analysis, or convert requirements into tracked work items after choosing a destination. Do not use for implementation planning of existing work.
---
# Arc Defining Work

Create new tracked work items. The leading word is **destination-first**: ask where to create work before analysis or mutation.

For story format and numbering, load [WORK_ITEM_FORMAT.md](WORK_ITEM_FORMAT.md). For destination-specific creation commands, load [GITHUB_DESTINATION.md](GITHUB_DESTINATION.md) or [AGILE_ACCELERATOR_DESTINATION.md](AGILE_ACCELERATOR_DESTINATION.md) after the user chooses. For PRD slicing rules, load [PRD_SLICING.md](PRD_SLICING.md) when the source is a PRD.

## Steps

1. **Choose destination before analysis.**
   - Ask: GitHub Issues or Agile Accelerator?
   - Do not infer the destination from repo context.
   - Wait for the user's answer before creating or deeply analyzing work items.

   Completion criterion: the run has one explicit destination, or it stops with the destination question.

2. **Detect source mode.**
   - Codebase analysis mode: user wants backlog/stories from observed gaps or next-phase improvements.
   - PRD breakdown mode: user wants requirements converted into vertical-slice work items.

   Completion criterion: the output states the selected mode and source material.

3. **Draft work items for approval.**
   - Use Gherkin user stories for feature/backlog work.
   - Use tracer-bullet vertical slices for PRD breakdowns.
   - Assign epic, priority, size, context, dependencies, and acceptance criteria.
   - Do not create records/issues before user approval unless the user explicitly asked to create without review.

   Completion criterion: every draft item is independently implementable or explicitly marked blocked/HITL.

4. **Create work items in the chosen destination.**
   - Preserve sequential `W-` numbering where applicable.
   - Create labels/project metadata for GitHub where useful.
   - For Agile Accelerator, let Salesforce assign `Name` and query it after creation.

   Completion criterion: every approved item exists in the chosen tracker, or exact tooling/permission blockers are reported.

5. **Verify and summarize.**
   - Query created issues/records.
   - Report IDs, links where available, destination, and any failed items.

   Completion criterion: the user receives a created-work summary with enough IDs/links to continue planning or implementation.

## Boundaries

- Use `arc-planning-work` for implementation plans for existing work items.
- Use `arc-prd-to-issues` when the user specifically wants PRD-to-GitHub-issues with a granularity quiz.
- Use `arc-creating-user-stories` when the destination is already GitHub Issues and the request is a Gherkin story backlog.
