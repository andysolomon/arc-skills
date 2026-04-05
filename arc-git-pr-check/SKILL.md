---
name: arc-git-pr-check
description: Idempotent git workflow that commits if needed, pushes if needed, creates a PR if missing, and enables squash auto-merge when PR is open. If changes exist on the default branch, it stashes changes, creates a semver feature branch, then restores changes before committing.
allowed-tools: Bash(git:*), Bash(gh:*), Bash(/Users/andrewsolomon/.claude/skills/arc-git-pr-check/bin/run.sh:*)
---

# ARC Git PR Check

Use this skill to run a safe, idempotent release hygiene pass:
- Commit if there are uncommitted changes
- Push if local commits are unpushed
- Create PR if branch has no PR
- Enable squash auto-merge if PR is open and not yet merged

## Safety Guard

Before committing, if on the default branch and there are local changes, this skill:
1. Stashes tracked and untracked changes
2. Creates a feature branch named `<type>/v<next-semver>-<slug>`
3. Pops the stash on the new branch

If stash pop conflicts, stop and resolve conflicts manually.

## Usage

```bash
/Users/andrewsolomon/.claude/skills/arc-git-pr-check/bin/run.sh
```

Optional flags:

```bash
/Users/andrewsolomon/.claude/skills/arc-git-pr-check/bin/run.sh --type feat --summary "add intake parser"
/Users/andrewsolomon/.claude/skills/arc-git-pr-check/bin/run.sh --base develop
/Users/andrewsolomon/.claude/skills/arc-git-pr-check/bin/run.sh --dry-run
```

## Commit Convention

Commit messages follow Conventional Commits:
- `feat: ...`
- `fix: ...`
- `chore: ...`
- `docs: ...`
- `test: ...`
- `refactor: ...`
- `perf: ...`
- `ci: ...`

If `--type` or `--summary` are not provided and a commit is needed, the script prompts for both.
