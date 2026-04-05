# arc-skills

Portable repository for ARC skills (`arc-*`) so they can be shared and installed on any machine.

## Contents

Each skill lives in its own directory and includes a `SKILL.md` entrypoint.

## Install (recommended: skills CLI)

This follows the `vercel-labs/skills` README flow.

### List available skills in this repo

```bash
npx skills add andysolomon/arc-skills --list
```

### Install all ARC skills in the current project (cwd)

```bash
npx skills add andysolomon/arc-skills --skill '*'
```

### Install all ARC skills in cwd for Claude Code + Codex only

```bash
npx skills add andysolomon/arc-skills -a claude-code -a codex --skill '*'
```

### Install all ARC skills globally for Claude Code + Codex

```bash
npx skills add andysolomon/arc-skills -g -a claude-code -a codex --skill '*'
```

### Install only specific skills

```bash
npx skills add andysolomon/arc-skills -g -a claude-code -a codex --skill arc-implementation-plan-progress --skill arc-ideabrowser-openclaw-flow
```

### Copy mode (instead of symlinks)

```bash
npx skills add andysolomon/arc-skills -g -a claude-code -a codex --skill '*' --copy
```

## Local installer (fallback)

You can also use the repo script:

```bash
./scripts/install.sh
```

This symlinks all `arc-*` skill folders into:
- `~/.claude/skills`
- `~/.codex/skills`

Use `--copy` to copy instead of symlink:

```bash
./scripts/install.sh --copy
```
