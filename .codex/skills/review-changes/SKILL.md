---
name: yummyyummix:review-changes
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
- Report sections

Read `docs/agent-guidelines/REVIEW-OUTPUT-SPEC.md` for canonical definitions of:
- Output section order and purposes
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

- **Frontend files** (`yyx-app/`) → `$yummyyummix:frontend` — review for convention violations (@/ imports, Text/Button from common, design tokens, FlashList, expo-image, i18n), performance issues, and component architecture.
- **Backend files** (`yyx-server/` excluding AI/migrations) → `$yummyyummix:backend` — review for edge function patterns, auth handling, error leakage, SSE streaming issues, and Deno conventions.
- **AI files** (`_shared/ai-gateway/`, `_shared/tools/`, `_shared/rag/`, orchestrators) → `$yummyyummix:ai-engineer` — review for gateway pattern violations, tool registry consistency, safety system gaps, and AI-specific issues.
- **Database files** (`yyx-server/supabase/migrations/`) → `$yummyyummix:database` — review for missing RLS, naming convention violations, unsafe DDL, missing indexes, and rollback concerns.
- **All files** → `$yummyyummix:code-reviewer` — cross-cutting: dead code, DRY violations, correctness bugs, type safety.

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
- Provide 2-3 options (including "do nothing" when reasonable).
- For each option include:
  - implementation effort
  - risk
  - cross-code impact
  - maintenance burden
- Put the recommended option first and explain why.

For `Warning` findings that materially affect readiness:
- Also include options/tradeoffs.

For `Suggestion` findings:
- Provide concise recommendation without full option matrix.

## Review Rules

- Be constructive and explicitly acknowledge good patterns.
- Prioritize high user impact and risk reduction.
- Be aggressive about DRY violations.
- Check project conventions against `CLAUDE.md` and `AGENT.md`.
- Favor explicit and maintainable code over cleverness.
- Call out under-engineering and over-engineering.
- Emphasize edge cases and failure paths.
- Prefer actionable guidance over style-only comments.

## Output Format

Use this structure:

````markdown
## Change Review: <label>

**Branch:** <branch>
**Commit Scope:** <resolved scope>
**Includes Uncommitted:** yes (staged + unstaged + untracked)
**Files Touched:** <count>

### Highlights
- <specific positive pattern>
- <specific positive pattern>

### Findings

#### Architecture & Design
- [Critical] `path/to/file.ts:42` - <issue>
  - Recommendation: <specific recommendation>
  - Options:
    1. **A (Recommended)** <option> - Effort: <S/M/L>, Risk: <...>, Impact: <...>, Maintenance: <...>
    2. **B** <option> - Effort: <...>, Risk: <...>, Impact: <...>, Maintenance: <...>

#### Correctness
- [Warning] `path/to/file.ts:120` - <issue>
  - Recommendation: <specific recommendation>

#### Security
- [Critical] `path/to/file.ts:88` - <issue>
  - Recommendation: <specific recommendation>
  - Options:
    1. **A (Recommended)** <option> - Effort: <...>, Risk: <...>, Impact: <...>, Maintenance: <...>
    2. **B** <option> - Effort: <...>, Risk: <...>, Impact: <...>, Maintenance: <...>

#### Performance
- [Suggestion] `path/to/file.tsx:55` - <issue>
  - Recommendation: <specific recommendation>

#### Code Quality
- [Warning] `path/to/file.ts:15` - <issue>
  - Recommendation: <specific recommendation>

#### Testing
- [Warning] `path/to/test-file.ts:1` - <gap>
  - Recommendation: <specific recommendation>

#### i18n
- [Suggestion] `path/to/file.tsx:77` - <issue>
  - Recommendation: <specific recommendation>

#### Commit Hygiene
- [Suggestion] <issue>
  - Recommendation: <specific recommendation>

#### Documentation
- [Suggestion] `path/to/file.md:18` - <issue>
  - Recommendation: <specific recommendation>

### Summary
- Critical: <count>
- Warning: <count>
- Suggestion: <count>

**Readiness:** <READY FOR PR | QUICK FIXES THEN PR | NEEDS WORK>

### Recommendations

| Rank | Recommendation | Impact | Effort | Rationale |
|------|----------------|--------|--------|-----------|
| 1 | <high-value improvement outside Findings> | High | Low | <reason> |
| 2 | <opportunity the changes open up> | Medium | Medium | <reason> |

Do NOT repeat issues already listed in Findings. These are opportunities related to the changes that the author may have missed.

### Potential Misses
- <uncertain area not fully verified and why>
- <additional validation recommended>

### Next Steps

```text
You are the implementation agent for branch <branch-name>.

## Review Findings — Fix All

### Critical
- [Critical] `file:line` — description

### Warning
- [Warning] `file:line` — description

## Suggestions — Implement If Worthwhile

### Suggestion
- [Suggestion] `file:line` — description

## Recommendations — Implement If Worthwhile

| Rank | Recommendation | Impact | Effort |
|------|----------------|--------|--------|
| 1 | ... | High | Low |

## Workflow

1. Read the relevant files to understand context.
2. Create an implementation plan that addresses all Critical/Warning findings plus any Suggestions/Recommendations worth implementing.
3. Implement the plan.
4. Run tests and validation for changed areas.
5. Report what was done and flag any issues encountered.

Constraints:
- Keep changes scoped to the branch objective.
- Avoid unrelated refactors.
```
````

For a reusable invocation template, use `references/review-changes-prompt.md`.
