# GitHub Destination

Load this only after the user chooses GitHub Issues.

## Labels

```bash
gh label create "epic: <name>" --color "<hex>" --description "<description>" 2>&1 || true
gh label create "priority: P0" --color "b60205" --description "Must do" 2>&1 || true
gh label create "priority: P1" --color "d93f0b" --description "Should do" 2>&1 || true
gh label create "priority: P2" --color "fbca04" --description "Nice to have" 2>&1 || true
gh label create "size: S" --color "c5def5" --description "Small" 2>&1 || true
gh label create "size: M" --color "bfd4f2" --description "Medium" 2>&1 || true
gh label create "size: L" --color "85bbf0" --description "Large" 2>&1 || true
gh label create "size: XL" --color "6fa8dc" --description "Extra large" 2>&1 || true
```

## Create issues safely

Write each issue body to a temp file and use `--body-file`.

```bash
gh issue create \
  --title "[W-000001] Short descriptive title" \
  --label "epic: <name>,priority: P1,size: M" \
  --body-file /tmp/issue-W-000001.md
```

## Project integration

```bash
gh project list --owner <owner>
gh project create --owner <owner> --title "<Repo Name>" --format json
gh project link <number> --owner <owner> --repo <owner>/<repo>
gh project item-add <number> --owner <owner> --url "https://github.com/<owner>/<repo>/issues/<issue>"
```

If project commands fail:

```bash
gh auth refresh -s read:project,project --hostname github.com
```

## Verify

```bash
gh issue list --limit 50 --state open
```

## PR convention

Later implementation PRs should include `Closes #<number>`.
