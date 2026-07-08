---
name: arc-work-issue
description: Work an open GitHub issue in a new git worktree, then commit, PR, merge, and clean up. Invoke with `#14` or `W-000014`.
disable-model-invocation: true
---

# Work Issue

Open an isolated git worktree, implement one **open** GitHub issue, then ship it end-to-end. The leading word is **worktree-first**: never implement on the main checkout.

Load [WORKTREE.md](WORKTREE.md) before creating the worktree. Load `arc-conventional-commits` before committing for commit type and message format.

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

7. **Open and merge the PR.**
   - Push the branch and open a PR per [WORKTREE.md](WORKTREE.md).
   - Put `Closes #<number>` in the PR body.
   - Wait for required checks when the repo enforces them, then squash-merge the PR.

   Completion criterion: the PR is merged on GitHub and the linked issue closes, or you report the exact merge/check blocker.

8. **Clean up the worktree.**
   - From the repository root, remove the worktree, prune stale entries, and delete the local feature branch per [WORKTREE.md](WORKTREE.md).
   - Return the shell to the main checkout.

   Completion criterion: `git worktree list` no longer shows the issue worktree and the local feature branch is removed.

## Boundaries

- Use `arc-planning-work` for plan-only requests; this skill implements and ships.
- Use `arc-parallel-implement` for multiple issues at once.
- Do not modify files in the main checkout or an unrelated worktree.
- Do not start work on closed issues.
- Do not leave the worktree behind after a successful merge.
