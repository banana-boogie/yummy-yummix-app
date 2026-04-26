---
name: status-update
description: Catch the user up on a feature branch — recent commits, uncommitted work, plan progress, merge-readiness checklist, and the critical files they personally need to review before merging to main.
---

# Status Update

## Overview

Single concise report that tells the user what changed recently and what stands between them and merging to main. Use when the user asks "where am I", "status", "catch me up", or returns to a branch after time away.

## Inputs

- Optional scope argument: path to the plan file driving this branch.
- Otherwise resolve plan in this order:
  1. `PLAN.md` at worktree root.
  2. Files matching `*<branch-name>*.md` in `../product-kitchen/repeat-what-works/plans/` and its `deferred/` subdirectory.
  3. Files matching `*<branch-name>*.md` in `docs/`.
  4. Ask the user once. If they skip, proceed without plan progress.

## Steps

### 1. Git state

Run:
- `git rev-parse --abbrev-ref HEAD`
- `git log -3 --format="%h %s"`
- `git status --short`

Count staged / unstaged / untracked. Do not dump full status — counts plus 1–3 notable files (new top-level files, migrations) at most.

### 2. Plan resolution and progress

Apply resolution order. Read the plan if found. Identify checklist items (`- [ ]`, `- [x]`, numbered task lists, "TODO" markers). For each, classify done / pending / uncertain using:

- Explicit `[x]` markers in the plan.
- Recent commits whose subject/body reference the item.
- Code presence where the plan named a concrete artifact.

Mark `[?]` when uncertain. Do not guess.

### 3. Critical files

From files changed since the branch diverged from default (`git diff --name-only $(git merge-base HEAD origin/main)..HEAD`), flag a file as **critical** if it matches any of:

- `**/supabase/migrations/**`
- `**/supabase/functions/*/index.ts`
- Auth, payment, billing, subscription, RLS policy paths (by path or content)
- New external API integrations
- New top-level files (screens, modules, edge functions)
- >100 net lines changed (`git diff --stat $base..HEAD`)
- Secrets / env / auth-token handling

Skip tests, lockfiles, generated files, translation-only diffs, formatting-only diffs.

Provide a one-line *why* per critical file.

### 4. Merge readiness

This project has no CI bot reviews — Codex and Claude reviews are run manually in the terminal. Checklist:

- All plan tasks done (or explicitly deferred).
- PR opened on GitHub. Detect via `gh pr view --json state,number,url 2>/dev/null` or `gh pr list --head <branch> --json number,url`.
- Codex review run — cannot infer; ask user to confirm.
- Claude review run — cannot infer; ask user to confirm.
- Feature manually verified — cannot infer; ask user.
- Critical files reviewed by user — cannot infer; ask user.

### 5. Output

Exact format. No preamble.

```markdown
## Status: <branch-name>

### Recent commits
- `<sha>` <subject>
- `<sha>` <subject>
- `<sha>` <subject>

### Uncommitted
staged: N | unstaged: N | untracked: N
<1-3 notable files if any, else omit>

### Plan progress (<plan-path-or-"no plan found">)
- [x] <done item> — <sha or file evidence>
- [ ] <pending item>
- [?] <uncertain item> — <why uncertain>

### Merge readiness
- [x/ ] All plan tasks done
- [x/ ] PR opened (<#N url> if open)
- [ ] Codex review — confirm with user
- [ ] Claude review — confirm with user
- [ ] Manually verified — confirm with user
- [ ] Critical files reviewed by you — confirm with user

### Critical files to review yourself
- `path/to/file` — <why>
- `path/to/file` — <why>

### Next action
<one sentence — the single most useful next step>
```

## Constraints

- Read-only. No lint, tests, builds, edits, pushes, PR creation, or comments.
- If not a git repo: say so and stop.
- If on `main` / default branch: report uncommitted state and recent commits, then stop. No merge-readiness to compute.
