---
name: arc-semantic-release
description: >
  Conventional commits and automatic semantic versioning for web applications.
  TRIGGER when: committing code, creating PRs, merging, tagging, releasing, or
  working with version management in Next.js/Vercel projects.
  DO NOT TRIGGER when: Salesforce-specific package versioning (use sf-2gp-pipeline).
---

# Semantic Release — Conventional Commits & Automatic Versioning

This skill ensures all commits follow the conventional commits specification and that the automatic semantic-release pipeline creates correct versions.

## Commit Message Format

```
<type>: <description>

[optional body]
[optional footer]
```

### Commit Types and Version Impact

| Type | When to Use | Version Impact | Example |
|------|------------|---------------|---------|
| `fix:` | Bug fixes, issues, refactors, perf | **Patch** (1.8.0 → 1.8.1) | `fix: resolve login timeout` |
| `feat:` | New features, new functionality | **Minor** (1.8.0 → 1.9.0) | `feat: add bulk import` |
| `docs:` | Documentation only | None | `docs: update API guide` |
| `style:` | Formatting, whitespace | None | `style: fix indentation` |
| `test:` | Adding or fixing tests | None | `test: add unit tests` |
| `chore:` | Build, tools, dependencies | None | `chore: update dependencies` |
| `ci:` | CI/CD workflow changes | None | `ci: add deploy step` |
| `revert:` | Reverting a previous commit | **Patch** | `revert: undo login change` |
| `perf:` | Performance improvements | **Patch** | `perf: optimize query` |

### Decision Tree

```
Fixing a bug or issue?
├─ YES → fix:
└─ NO
   └─ Adding new functionality?
      ├─ YES → feat:
      └─ NO
         └─ Performance improvement?
            ├─ YES → fix: or perf:
            └─ NO → docs: / style: / test: / chore: / ci:
```

## PR Workflow

### 1. Branch naming
```bash
feat/W-000041-vercel-env-vars      # Feature work tied to an issue
fix/W-000046-error-handling         # Bug fix tied to an issue
chore/update-dependencies           # Maintenance work
ci/add-release-workflow             # CI/CD changes
```

### 2. Commits during development
Use the correct prefix for each commit. Mixed commits are fine — highest impact wins:
- If ANY commit is `feat:` → Minor version
- If ALL version-bumping commits are `fix:` → Patch version
- If no `feat:` or `fix:` → No version created

### 3. PR description
Always include `Closes #<issue-number>` to auto-close the linked issue on merge:
```markdown
## Summary
Brief description of changes

## Related Issue
Closes #42

## Type of Change
- [x] New feature
```

### 4. Merge strategy
**Squash & Merge is recommended** for clean version history.

You can override the version impact at merge time:
- PR has `feat:` commits but you squash with `fix:` message → Patch version
- PR has `fix:` commits but you squash with `feat:` message → Minor version

## How Automatic Release Works

On every push to `main`:

1. `semantic-release` analyzes all commits since the last tag
2. Determines the version bump (patch/minor/none) based on commit types
3. If a bump is needed:
   - Updates `package.json` version
   - Creates a git tag (e.g., `v1.2.0`)
   - Generates a changelog grouped by commit type
   - Creates a GitHub Release with the changelog
   - Commits the version bump as `chore(release): v1.2.0`

**Commits with `chore(release):` prefix are skipped** by semantic-release to avoid infinite loops.

## Configuration

### `.releaserc.json`
```json
{
  "branches": ["main"],
  "tagFormat": "v${version}",
  "plugins": [
    ["@semantic-release/commit-analyzer", {
      "preset": "conventionalcommits"
    }],
    ["@semantic-release/release-notes-generator", {
      "preset": "conventionalcommits"
    }],
    ["@semantic-release/npm", { "npmPublish": false }],
    ["@semantic-release/git", {
      "assets": ["package.json"],
      "message": "chore(release): v${nextRelease.version}"
    }],
    "@semantic-release/github"
  ]
}
```

### GitHub Actions Release Workflow
```yaml
name: Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    if: "!contains(github.event.head_commit.message, 'chore(release):')"
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npx semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Milestone → Release → Tag Chain

```
Issues close via PR merge (Closes #42)
  → Milestone tracks wave progress
    → Push to main triggers semantic-release
      → Tag + GitHub Release created automatically
        → Milestone closed manually via milestone-release workflow
```

## Branch Protection

Main branch should have:
- **Required status check:** CI workflow must pass
- **Strict:** Branch must be up-to-date before merge
- **No force pushes**
- **No direct pushes** (PRs only)

## Guidelines

- **Always** use a semantic prefix on every commit message
- **Never** use generic messages like "update code" or "fix stuff"
- **Always** include `Closes #` in PR descriptions to link issues
- **Prefer** squash & merge for clean release history
- **Do not** manually create tags or releases — let semantic-release handle it
- **Do not** edit `package.json` version manually — semantic-release manages it
- The `chore(release):` commits are auto-generated — never write these yourself

## Related Skills

- [sf-2gp-pipeline](../sf-2gp-pipeline/SKILL.md) — Salesforce package versioning (uses same commit conventions)
- [arc-creating-user-stories](../arc-creating-user-stories/SKILL.md) — Creating issues that feed into milestones
