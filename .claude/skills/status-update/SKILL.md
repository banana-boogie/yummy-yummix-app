---
name: status-update
description: Catch the user up to speed on a feature branch — recent changes, uncommitted work, plan progress, merge-readiness checklist, and which files they personally need to review before merging
---

# Status Update Skill

Use when the user asks "where am I on this branch?", "status", "catch me up", or returns to a feature branch after time away. The goal is a single concise report that tells the user what changed recently and what stands between them and merging to main.

## Inputs

- Optional `$ARGUMENTS` = path to the plan file driving this branch.
- Otherwise the skill resolves the plan in this order:
  1. `PLAN.md` at the worktree root.
  2. Files matching `*<branch-name>*.md` in `../product-kitchen/repeat-what-works/plans/` (and `../product-kitchen/repeat-what-works/plans/deferred/`).
  3. Files matching `*<branch-name>*.md` in `docs/`.
  4. Ask the user once: *"I couldn't find a plan file for this branch. Path?"* If they say none/skip, proceed without plan progress.

## Steps

### 1. Gather git state

```bash
git rev-parse --abbrev-ref HEAD
git log -3 --format="%h %s"
git status --short
```

Count: staged, unstaged, untracked. Do NOT dump the full status — just counts and the files that are clearly meaningful (new top-level files, migrations).

### 2. Resolve the plan

Apply the resolution order above. If found, read it. Identify checklist-style items (`- [ ]`, `- [x]`, numbered task lists, "TODO" markers). For each item, decide done vs. pending using:

- Explicit `[x]` checkboxes in the plan.
- Recent commits whose subject/body clearly reference the item.
- Code presence (file exists, function exists) where the plan named a concrete artifact.

When uncertain, mark `[?]` rather than guessing.

### 3. Identify critical files for user review

From files changed on this branch since it diverged from the default branch (`git diff --name-only $(git merge-base HEAD origin/main)..HEAD`), flag a file as **critical** if it matches any:

- Database migrations: `**/supabase/migrations/**`
- Edge function entry points: `**/supabase/functions/*/index.ts`
- Auth, payment, billing, subscription, RLS policy paths (match by path or content)
- External API integration files (anything calling out to a third-party service for the first time)
- New top-level files (new screens, new modules, new edge functions)
- Files with >100 net lines changed (`git diff --stat $base..HEAD`)
- Anything touching secrets, environment variable handling, or auth tokens

Skip: tests, lockfiles, generated files, translations-only diffs, formatting-only diffs.

For each critical file, give a one-line *why*.

### 4. Check merge-readiness

The merge-readiness checklist for this project (no CI bot reviews — reviews are run manually in terminal):

- All plan tasks done (or explicitly deferred)
- PR opened on GitHub
- Codex review run (manual; ask the user — don't assume)
- Claude review run (manual; ask the user — don't assume)
- Feature manually verified by the user
- Critical files reviewed by the user

Determine each checkbox:
- "Plan tasks done" — from step 2.
- "PR opened" — `gh pr view --json state,number,url 2>/dev/null` or `gh pr list --head $(current-branch) --json number,url`.
- The remaining four cannot be inferred from git. List them as `[ ]` and tell the user to confirm.

### 5. Output

Format exactly as below. Keep it short. No preamble.

```markdown
## Status: <branch-name>

### Recent commits
- `<sha>` <subject>
- `<sha>` <subject>
- `<sha>` <subject>

### Uncommitted
staged: N | unstaged: N | untracked: N
<list 1-3 notable files if any, otherwise omit>

### Plan progress (<plan-path-or-"no plan found">)
- [x] <done item> — <evidence: sha or file>
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
<one sentence — the single most useful thing the user can do next>
```

## Constraints

- Do not run lint, tests, or builds. This is a read-only status report.
- Do not edit files.
- Do not push, open PRs, or comment.
- If the working directory is not a git repo, say so and stop.
- If the branch is `main` or the default branch, report uncommitted state and recent commits and stop — there's no "merge readiness" to compute.
