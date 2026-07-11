---
name: arc-pr-review-loop
description: Review a PR against its plan, post actionable PR comments, have a coding agent address them, and repeat until approved or a round limit is hit. Invoke with a PR number/URL, e.g. `/arc-pr-review-loop 27`.
disable-model-invocation: true
---

# PR Review Loop

Iterate a PR to plan-alignment through review comments. The leading word is **converge**: every round must either approve or produce actionable comments that shrink the gap to the plan — never a rubber stamp, never vague feedback.

This is the review counterpart to `arc-work-issue --ship pr`: a cheaper agent opens the PR, this loop supplies the judgment. Merge authority stays with the caller unless `--merge-on-approve` is passed.

## Input

- PR number or URL (required). If absent, ask and stop.
- `--plan <file|issue>` — plan source override.
- `--max-rounds <N>` — review rounds before escalating (default 3).
- `--merge-on-approve` — squash-merge on approval via `arc-git-pr-check --ship merge`; without it, approval is reported and the caller merges.

## Steps

1. **Resolve the PR and its plan.**
   - `gh pr view <n> --json title,body,headRefName,url,files` plus the diff (`gh pr diff <n>`).
   - Find the plan: `--plan` if given; else the issue referenced by `Closes #<n>` and any implementation-plan comment on it (per `arc-planning-work`); else the PR body's stated intent.
   - Locate the working copy for fixes: the branch's existing worktree (`git worktree list`) or check the branch out fresh.

   Completion criterion: the loop has a diff, a plan with acceptance criteria (or the explicit note that none exists), and a writable checkout of the PR branch.

2. **Review round: diff vs plan.**
   - Judge only what the plan and acceptance criteria require plus correctness/safety of the changed code; do not expand scope.
   - Classify each finding **blocking** (violates plan, acceptance criterion, or correctness) or **nit** (better, not required).
   - Verdict: **approve** when no blocking findings remain.

   Completion criterion: a verdict plus a findings list where every blocking finding names the file, the problem, and what done looks like.

3. **Post the round to the PR.**
   - Approve: `gh pr review <n> --approve --body "<summary>"`, then go to step 6.
   - Revise: `gh pr review <n> --request-changes --body "<round summary>"` and one `gh pr comment` (or inline review comments) per blocking finding so each is independently addressable.

   Completion criterion: every blocking finding exists as a PR comment an agent can act on without reading this conversation.

4. **Address the comments.**
   - Apply fixes in the PR branch's worktree — directly or by delegating to a coding agent with the comments as the task contract.
   - Fix only what the comments name; unrelated improvements are new work items.
   - Run the repo's test/lint commands; then commit (conventional message referencing the round, e.g. `fix: address review round 2`) and push to the PR branch.

   Completion criterion: every blocking comment has a corresponding pushed change or a reply explaining why it is not actionable.

5. **Loop.**
   - Return to step 2. After `--max-rounds` rounds without approval, stop: summarize the unresolved blocking findings on the PR and to the caller, and recommend escalation (stronger implementation model, or human decision).

   Completion criterion: the loop exits only via approval or the round limit — never by silently accepting unresolved blocking findings.

6. **Hand off.**
   - With `--merge-on-approve`: run `arc-git-pr-check` with `--ship merge`, then confirm the merge.
   - Otherwise: report verdict, rounds used, findings resolved, and the PR URL; the caller (e.g. an orchestrator's `story_merge`) owns the merge.

   Completion criterion: the caller receives verdict, round count, and PR URL, and the merge happened only if explicitly requested.

## Boundaries

- Use `arc-work-issue --ship pr` to produce the PR this loop consumes; this skill never implements the original issue from scratch.
- Use `arc-git-pr-check` for any merge; never `gh pr merge` directly.
- Use `arc-bug-finder` for defects discovered outside the PR's scope — file them, don't fix them here.
- Do not force-push or rewrite the PR branch's history; reviewers' comment anchors must survive.
