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

Read `references/REVIEW-CRITERIA.md` for canonical definitions of:
- Engineering preferences
- Review categories (8 categories with full checklists)
- Severity levels (Critical / Warning / Suggestion)
- Recommendation logic (pre-PR context: READY FOR PR / QUICK FIXES THEN PR / NEEDS WORK)
- Report sections

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

## Review Dimensions

Evaluate all 8 categories from `references/REVIEW-CRITERIA.md`:
1. Architecture & Design
2. Correctness
3. Security
4. Performance
5. Code Quality
6. Testing
7. i18n
8. Hygiene (use "Commit Hygiene" label for this context)

## Severity and Depth Rules

Use severity labels from `references/REVIEW-CRITERIA.md`: **Critical**, **Warning**, **Suggestion**.

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

### Good Patterns Observed
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

### Suggestions and Improvements (Ranked by Impact vs Effort)
| Rank | Suggestion | Impact | Effort | Rationale |
|------|------------|--------|--------|-----------|
| 1 | <suggestion> | High | Medium | <reason> |
| 2 | <suggestion> | Medium | Low | <reason> |
| 3 | <suggestion> | Medium | Medium | <reason> |

### Potential Misses
- <uncertain area not fully verified and why>
- <additional validation recommended>

### Summary
- Critical: <count>
- Warning: <count>
- Suggestion: <count>

**Readiness:** <READY FOR PR | QUICK FIXES THEN PR | NEEDS WORK>

### Next-Step Agent Prompt
```text
You are the implementation agent for this change set.

Objective:
- Improve this change set by addressing high-value findings and applying worthwhile improvements while preserving the original feature intent.

Workflow:
1. Create an implementation plan first.
2. Prioritize items by user impact, risk reduction, and effort.
3. Implement only recommendations worth doing for this objective.
4. Defer low-value or out-of-scope items with explicit rationale.
5. Run targeted validation (tests/checks) for touched areas.
6. Report: implemented items, deferred items, validation results, residual risks.

Constraints:
- Do not modify `.claude/`.
- Keep changes scoped and avoid unrelated refactors.
- Prefer explicit, maintainable solutions.
```
````

For a reusable invocation template, use `references/review-changes-prompt.md`.
