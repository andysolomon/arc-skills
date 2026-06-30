---
name: arc-creating-user-stories
description: Gherkin user-story backlog creation for GitHub Issues. Use when asked to create development stories, write GitHub issues from a plan, build a feature backlog, or turn feature ideas into tracked user stories. Do not use for implementation planning after issues already exist.
---
# Arc Creating User Stories

Create a tracked backlog of independently deliverable user stories. The leading word is **Gherkin**: every story must be testable through Given/When/Then scenarios.

For story/body templates and acceptance-criteria rules, load [GHERKIN.md](GHERKIN.md). For `gh` commands, labels, Projects, and auth details, load [GITHUB.md](GITHUB.md) when you are ready to create issues.

## Steps

1. **Inspect the request and repo.**
   - Identify whether the user wants story creation, not just implementation planning or generic brainstorming.
   - Read enough repo files, PRD/specs, existing issues, and project context to avoid duplicate or imaginary work.

   Completion criterion: every proposed epic is grounded in a user request, existing artifact, or observed codebase gap.

2. **Draft the backlog before creating issues.**
   - Group stories into epics/themes.
   - Make each story independently deliverable and small enough to be implemented by one agent or developer.
   - Assign priority (`P0`/`P1`/`P2`) and size (`S`/`M`/`L`/`XL`).
   - Use sequential `W-000001` IDs; inspect existing issues first and increment from the highest existing `W-` number.

   Completion criterion: every story has an ID, title, epic, priority, size, user-story sentence, Gherkin acceptance criteria, and concrete context.

3. **Review the backlog with the user before mutation.**
   - Present the proposed epics and stories.
   - Ask for approval before creating labels, issues, or project items unless the user explicitly asked you to proceed without review.

   Completion criterion: either the user approves issue creation, or the response stops at the proposed backlog.

4. **Create GitHub tracking artifacts after approval.**
   - Create missing epic, priority, and size labels.
   - Create issues with `gh issue create --body-file`; never inline markdown bodies with `--body`.
   - Create or find the repo GitHub Project, link it to the repo, and add each issue.

   Completion criterion: every approved story has a GitHub issue, the issue has the expected labels, and each issue is added to the linked project or a blocking GitHub permission error is reported.

5. **Verify and summarize.**
   - Run `gh issue list --limit 50 --state open` or an equivalent query to confirm created issues.
   - Report issue URLs/numbers, project status, and any follow-up such as required auth scopes.
   - When later implementing these issues, PR bodies should include `Closes #<number>`.

   Completion criterion: the user receives a concise created-work summary with links and any unresolved blockers.

## Boundaries

- Use `arc-planning-work` or `arc-planning-github-issues` when the user asks to plan implementation of an existing issue.
- Use `arc-defining-work` when the user wants work items created across a destination chosen at runtime.
- Use this skill when the output is specifically GitHub Issues containing Gherkin user stories.
