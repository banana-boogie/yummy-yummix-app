---
name: review-changes
description: Review latest local changes (recent commits and current working tree) for security, code quality, correctness, performance, design, testing, documentation, and i18n. Use when preparing to commit/push or when asked to review recent changes without a PR.
---

# Review Changes

## Overview

Review recent local changes in a single pass and return prioritized, actionable feedback with file and line references.

## Required Inputs

- Optional scope argument from user:
  - none
  - `<N>` for last N commits
  - `<A..B>` explicit commit range
- Git repository context

## Review Criteria

Read `docs/agent-guidelines/REVIEW-CRITERIA.md` for canonical definitions of:
- Engineering preferences
- Review categories (9 categories with full checklists)
- Severity levels (Critical / Warning / Suggestion)
- Recommendation logic (pre-PR context: READY FOR PR / QUICK FIXES THEN PR / NEEDS WORK)

Read `docs/agent-guidelines/REVIEW-OUTPUT-SPEC.md` for canonical definitions of:
- Two-tier output format (human summary + AI handoff)
- Finding format (including options/tradeoffs for Critical findings)
- Next Steps prompt contract

Apply these criteria throughout the review.

## Scope Resolution

Resolve review scope in this order:

1. No argument:
- Resolve upstream for current branch.
- Commit scope: `<upstream>..HEAD`
- Include uncommitted changes (staged, unstaged, and untracked) in all cases.
- If upstream cannot be resolved, ask user for explicit `<N>` or `<A..B>`.

2. Numeric argument `<N>`:
- Commit scope: `HEAD~<N>..HEAD`
- Include uncommitted changes (staged, unstaged, and untracked).

3. Explicit range `<A..B>`:
- Commit scope: exactly `<A..B>`
- Include uncommitted changes (staged, unstaged, and untracked).

4. Invalid argument:
- Ask user to provide either `<N>` or `<A..B>`.

## Gather Context

Use commands that match the resolved scope:

```bash
git rev-parse --abbrev-ref HEAD
git rev-parse --abbrev-ref --symbolic-full-name @{upstream}
git status --short
git log --oneline <COMMIT_SCOPE>
git diff --name-status <COMMIT_SCOPE>
git diff <COMMIT_SCOPE>
git diff --cached
git diff
git ls-files --others --exclude-standard
```

Untracked-file handling:
- Discover untracked paths with `git ls-files --others --exclude-standard`.
- For each relevant untracked file, inspect file contents directly (for example: `sed -n '1,200p' <file>`), then include findings with file references.

## Categorize Changed Files

- Frontend: `yyx-app/`
- Backend/Edge: `yyx-server/`
- Database: `yyx-server/supabase/migrations/`
- Infrastructure/Tooling: `.github/`, config files, scripts
- Documentation: `*.md`

## Domain Delegation

Route changed files to specialized domain skills for deeper review. Invoke skills for domains with changed files:

- **Frontend files** (`yyx-app/`) → `$frontend` — review for convention violations (@/ imports, Text/Button from common, design tokens, FlashList, expo-image, i18n), performance issues, and component architecture.
- **Backend files** (`yyx-server/` excluding AI/migrations) → `$backend` — review for edge function patterns, auth handling, error leakage, SSE streaming issues, and Deno conventions.
- **AI files** (`_shared/ai-gateway/`, `_shared/tools/`, `_shared/rag/`, orchestrators) → `$ai-engineer` — review for gateway pattern violations, tool registry consistency, safety system gaps, and AI-specific issues.
- **Database files** (`yyx-server/supabase/migrations/`) → `$database` — review for missing RLS, naming convention violations, unsafe DDL, missing indexes, and rollback concerns.
- **All files** → `$code-reviewer` — cross-cutting: dead code, DRY violations, correctness bugs, type safety.

Only invoke skills for domains that have changed files (except code-reviewer which always runs). Tell each skill it is in **review mode** — analysis only, no modifications. Pass the relevant file list and diff context.

## Review Dimensions

Evaluate all 9 categories from `docs/agent-guidelines/REVIEW-CRITERIA.md`:
1. Architecture & Design
2. Correctness
3. Security
4. Performance
5. Code Quality
6. Testing
7. i18n
8. Hygiene (use "Commit Hygiene" label for this context)
9. Documentation

## Severity and Depth Rules

Use severity labels from `docs/agent-guidelines/REVIEW-CRITERIA.md`: **Critical**, **Warning**, **Suggestion**.

For every finding:
- Include file path and line number when possible.
- Include a specific recommendation/fix.

For `Critical` findings:
- Provide 2-3 options with tradeoffs (effort, risk, impact, maintenance burden). Put the recommended option first.

For `Warning` findings that materially affect readiness:
- Also include options/tradeoffs.

For `Suggestion` findings:
- Provide concise recommendation without full option matrix.

## Review Rules

- Be constructive and explicitly acknowledge good patterns.
- Prioritize high user impact and risk reduction.
- Be aggressive about DRY violations.
- Check project conventions against `CLAUDE.md` and `AGENTS.md`.
- Favor explicit and maintainable code over cleverness.
- Call out under-engineering and over-engineering.
- Emphasize edge cases and failure paths.
- Prefer actionable guidance over style-only comments.

## Output Format

The report has **two sections**: a short human-readable summary, and a detailed Next Steps prompt for the implementing AI. **Keep the human section short and scannable. Put all the detail in Next Steps.**

````markdown
## Change Review: <label>

**Branch:** <branch> | **Scope:** <resolved scope> | **Files:** <count>

### Verdict

**<READY FOR PR / QUICK FIXES THEN PR / NEEDS WORK>** — <critical count> critical, <warning count> warnings, <suggestion count> suggestions

### Highlights

Bold-label paragraph blocks. Each highlight is two lines, no list syntax. The intro line carries the plain-language user/product/architectural value (max ~20 words, no file paths or API names). The `**Where:**` line carries the file pointer and the mechanic. A blank line separates entries. Drop highlights you can only express technically.

**Highlight 1.** <plain-language value: what's good about this and why it matters>
**Where:** `file:line` — <the technical mechanic that delivers it>

### Issues at a Glance

One row per finding, sorted Critical → Warning → Suggestion. Numbers (#) are reused in Next Steps. Area is one of: Frontend, Backend, Database, AI, Infra, Docs, i18n, Tests. If zero findings, write *No issues found.* and omit the table.

| # | Sev        | Area     | File                       | Issue                              |
|---|------------|----------|----------------------------|------------------------------------|
| 1 | Critical   | <area>   | `file:line`                | <6-12 word headline>               |
| 2 | Warning    | <area>   | `file:line`                | <6-12 word headline>               |
| 3 | Suggestion | <area>   | `file:line`                | <6-12 word headline>               |

---

### Next Steps

> Copy-paste the prompt below to the implementing AI.

```text
You are the implementation agent for branch <branch-name>.

## Review Findings — Fix All

Finding numbers (#N) match the "Issues at a Glance" table in the review.

### Critical
- **#1** [Critical] `file:line` — description
  - Recommendation: <specific recommendation>
  - Options:
    1. **A (Recommended)** <option> - Effort: S/M/L, Risk: <...>, Impact: <...>
    2. **B** <option> - Effort: S/M/L, Risk: <...>, Impact: <...>

### Warning
- **#2** [Warning] `file:line` — description
  - Recommendation: <specific recommendation>

## Recommended Improvements

Only include suggestions the reviewer actively recommends. If it's not worth doing, don't list it.

- **#3** `file:line` — description. Do: <specific action>

## Potential Misses

Areas the review couldn't fully evaluate:
- <what was uncertain and why>

## Workflow

1. Read the relevant files to understand context.
2. Create an implementation plan that addresses all findings and recommended improvements.
3. Implement the plan.
4. Run tests and validation for changed areas.
5. Report what was done and flag any issues encountered.

Constraints:
- Keep changes scoped to the branch objective.
- Avoid unrelated refactors.
```
````

For a reusable invocation template, use `references/review-changes-prompt.md`.
