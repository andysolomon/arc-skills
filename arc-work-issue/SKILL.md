---
name: arc-work-issue
description: Work an open GitHub issue in a new git worktree, then ship it — merge the PR (default), enable auto-merge, or leave the PR open for review. Invoke with `#14` or `W-000014`, optionally `--ship merge|auto|pr`.
disable-model-invocation: true
---

# Work Issue

Open an isolated git worktree, implement one **open** GitHub issue, then ship it. The leading word is **worktree-first**: never implement on the main checkout. PR mechanics (push, PR creation, merge) are delegated to `arc-git-pr-check`.

Load [WORKTREE.md](WORKTREE.md) before creating the worktree. Load `arc-conventional-commits` before committing for commit type and message format.

## Input

The user invokes this skill with a work-item reference and an optional ship mode:

- `#14` or `14` — GitHub issue number
- `W-000014` — story ID in the issue title or body
- `--ship merge` (default) — squash-merge the PR and clean up the worktree
- `--ship auto` — enable squash auto-merge, stop; worktree stays until merge completes
- `--ship pr` — open the PR and stop; leave the worktree and branch alive so a reviewer (e.g. `arc-pr-review-loop` or an orchestrator's premium model) can comment and iteration can continue

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

   Completion criterion: you can state what "done" means from the issue or a posted plan.

5. **Implement and verify in the worktree.**
   - Make the smallest correct change that satisfies acceptance criteria.
   - Run the repo's test/lint/typecheck commands from the worktree.

   Completion criterion: tests relevant to the change pass, or you report a concrete blocker before shipping.

6. **Commit with Conventional Commits.**
   - Follow `arc-conventional-commits` for type and message format (`feat:`, `fix:`, etc.).
   - Use a subject that matches the issue; include `Closes #<number>` in the commit body.
   - Stage only issue-scoped files; never commit on the default branch.

   Completion criterion: the feature branch has at least one conventional commit on the worktree branch.

7. **Ship via `arc-git-pr-check`.**
   - Write the PR body to a temp file; include `Closes #<number>` and a change summary.
   - From the worktree, run the `arc-git-pr-check` script with the chosen mode:
     `run.sh --ship <merge|auto|pr> --title "<conventional title>" --body-file <path> --staged-only`
   - Do not push, create, or merge the PR with raw `gh` commands; the script owns those mechanics.

   Completion criterion, by mode — `merge`: the PR is squash-merged and the linked issue closes; `auto`: auto-merge is enabled and the PR URL is reported; `pr`: the PR is open with its URL reported for review. Otherwise report the exact blocker from the script's status table.

8. **Clean up the worktree (merge mode only).**
   - When the PR is merged: from the repository root, remove the worktree, prune stale entries, and delete the local feature branch per [WORKTREE.md](WORKTREE.md); return the shell to the main checkout.
   - In `pr` and `auto` modes: leave the worktree and branch in place — review iteration happens there — and report the worktree path plus PR URL as the handoff.

   Completion criterion: merged work leaves no worktree behind; unmerged work reports worktree path and PR URL.

## Boundaries

- Use `arc-planning-work` for plan-only requests; this skill implements and ships.
- Use `arc-parallel-implement` for multiple issues at once.
- Use `arc-git-pr-check` for all push/PR/merge mechanics; never inline them here.
- Use `arc-pr-review-loop` to review and iterate on a PR opened with `--ship pr`.
- Do not modify files in the main checkout or an unrelated worktree.
- Do not start work on closed issues.
- Do not leave the worktree behind after a successful merge.
