---
name: arc-work-issue
description: Work an open GitHub issue in a new git worktree. Invoke with `#14` or `W-000014`.
disable-model-invocation: true
---

# Work Issue

Open an isolated git worktree and implement one **open** GitHub issue. The leading word is **worktree-first**: never implement on the main checkout.

For git/gh command recipes and branch naming, load [WORKTREE.md](WORKTREE.md) before creating the worktree.

## Input

The user invokes this skill with only a work-item reference:

- `#14` or `14` — GitHub issue number
- `W-000014` — story ID in the issue title or body

If no reference is present, ask for one and stop.

## Steps

1. **Resolve the GitHub issue.**
   - Map `#N` / `N` directly to issue `N`.
   - Map `W-XXXXXX` by searching open issues for that ID in title or body.
   - Fetch with `gh issue view` and confirm `state` is `OPEN`.

   Completion criterion: you have issue number, title, body, and comments, or you report the issue is missing/closed/ambiguous.

2. **Extract the W- ID and branch name.**
   - Prefer `W-XXXXXX` from the issue title; otherwise use `issue-<number>`.
   - Derive `feat/<id>-<short-kebab-slug>` from the title.

   Completion criterion: branch name is chosen before `git worktree add`.

3. **Create the worktree.**
   - From the repository root, add a new worktree and branch per [WORKTREE.md](WORKTREE.md).
   - Treat the worktree path as the sole working directory for all reads, edits, tests, and commits.

   Completion criterion: `git worktree list` shows the new path on the new branch and your shell cwd is inside it.

4. **Ground on existing plan material.**
   - Read issue body and comments for an implementation plan or acceptance criteria.
   - If no plan exists and scope is non-trivial, run `arc-planning-work` in the worktree context before coding.

   Completion criterion: you can state what "done" means from the issue or an posted plan.

5. **Implement and verify in the worktree.**
   - Make the smallest correct change that satisfies acceptance criteria.
   - Run the repo's test/lint/typecheck commands from the worktree.
   - Commit only when verification passes; include `Closes #<number>` in the commit body.

   Completion criterion: tests relevant to the change pass and the worktree has at least one commit on the feature branch, or you report a concrete blocker.

6. **Ship when the user expects a PR.**
   - Push the branch and open a PR with `gh pr create` unless the user asked to stop after local work.
   - Link the issue in the PR body with `Closes #<number>`.

   Completion criterion: PR URL is returned, or you explicitly confirm local-only work was requested.

## Boundaries

- Use `arc-planning-work` for plan-only requests; this skill implements.
- Use `arc-parallel-implement` for multiple issues at once.
- Do not modify files in the main checkout or an unrelated worktree.
- Do not start work on closed issues.
