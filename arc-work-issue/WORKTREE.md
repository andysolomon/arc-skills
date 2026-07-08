# Worktree Setup

Load this when creating or reusing a worktree for `arc-work-issue`.

## Defaults

- **Worktree root:** `../wt` (sibling of the repository root)
- **Worktree path:** `../wt/issue-<number>` or `../wt/<W-id>` when a `W-` ID exists
- **Base ref:** `origin/main`, falling back to `main` or `master` if needed

## Resolve W- ID to issue number

```bash
gh issue list --search "W-000014 in:title" --state open --json number,title --limit 5
```

If title search fails, search body text or list open issues and match `[W-000014]` / `W-000014`.

Ambiguous multiple matches: stop and ask the user which issue to use.

## Fetch issue

```bash
gh issue view <number> --json number,title,body,state,comments
```

Stop if `state` is not `OPEN`.

## Branch naming

```bash
# With W- ID in title, e.g. "[W-000014] Add queue retry"
feat/W-000014-add-queue-retry

# Without W- ID
feat/issue-14-add-queue-retry
```

Slug rules: lowercase, hyphens, drop punctuation, max ~40 chars.

## Create worktree

Run from the repository root (not inside an existing worktree):

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
ISSUE=14
BRANCH="feat/W-000014-add-queue-retry"
WT_DIR="$(dirname "$REPO_ROOT")/wt/issue-${ISSUE}"

git fetch origin
mkdir -p "$(dirname "$WT_DIR")"
git worktree add -b "$BRANCH" "$WT_DIR" origin/main
cd "$WT_DIR"
```

If the branch already exists locally, attach with `git worktree add "$WT_DIR" "$BRANCH"` instead of `-b`.

If `origin/main` is missing, use the repo's default branch.

## Push and open PR

```bash
git push -u origin HEAD

gh pr create \
  --base main \
  --title "feat: <short title>" \
  --body "$(cat <<'EOF'
## Summary
<what changed>

## Related Issue
Closes #<number>
EOF
)"
```

Use `arc-conventional-commits` commit/PR conventions when the repo already follows them.

## Cleanup (later)

After merge:

```bash
git worktree remove "$WT_DIR"
git branch -d "$BRANCH"
git push origin --delete "$BRANCH"  # only when policy allows
```
