---
name: yummyyummix:review-pr
description: Review pull requests for architecture, correctness, security, testing coverage, performance, and project conventions. Use when asked to evaluate a GitHub PR (number or URL), summarize merge risk, or provide an approve/comment/request-changes recommendation.
---

# PR Review

## Overview

Review one pull request end-to-end and return clear, prioritized findings with a final merge recommendation.

## Required Inputs

- Optional PR number or URL
- Repository with GitHub CLI access (`gh`)
- Optional review focus (for example: security, testing, performance)

If no PR identifier is provided, resolve the PR from the current branch and ask for confirmation before starting the review.
If the PR identifier is provided but invalid, ask for a valid PR number or URL before continuing.

## Review Criteria

Read `references/REVIEW-CRITERIA.md` for canonical definitions of:
- Engineering preferences
- Review categories (8 categories with full checklists)
- Severity levels (Critical / Warning / Suggestion)
- Recommendation logic (PR context: APPROVE / COMMENT / REQUEST CHANGES)
- Report sections

Apply these criteria throughout the review.

## PR Target Resolution (Required First Step)

Resolve the PR target before running review commands:

1. Explicit PR argument provided:
- Accept PR number or URL and use it directly.
- If invalid, ask user for a valid PR number or URL.

2. No PR argument provided:
- Discover current branch and candidate PR:
```bash
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
gh pr list --head "$CURRENT_BRANCH" --state open --limit 1 --json number,url,title,headRefName,baseRefName,state,isDraft
```
- If `gh pr list` fails due connectivity/auth issues, retry once.
- If retry still fails, try branch-bound `gh pr view` fallback:
```bash
gh pr view --json number,url,title,headRefName,baseRefName,state,isDraft
```
- If a PR is found, ask for confirmation before review:
  - "I found PR #<number> (`<head>` -> `<base>`) for branch `<CURRENT_BRANCH>`: <title>. Do you want me to review this PR?"
- Proceed only after user confirms.
- If no PR is found or branch resolution cannot be completed, ask user for explicit PR number or URL.
- Do not infer PR number from stale/previous session results when current resolution fails.

## Workflow

1. Gather context with primary GitHub CLI commands:
```bash
gh pr view <pr>
gh pr diff <pr>
gh pr checks <pr>
gh pr view <pr> --json commits --jq '.commits[].messageHeadline'
```
2. If primary commands fail (GraphQL deprecation surface, API throttling, or transient network issues), use resilient fallback:
```bash
gh pr view <pr> --json number,title,author,headRefName,baseRefName,changedFiles,additions,deletions,body,url
BASE_BRANCH=$(gh pr view <pr> --json baseRefName --jq '.baseRefName')
HEAD_BRANCH=$(gh pr view <pr> --json headRefName --jq '.headRefName')
gh pr view <pr> --json files --jq '.files[].path'
gh pr checks <pr>
git fetch origin "$BASE_BRANCH"
git fetch origin "$HEAD_BRANCH"
git diff --name-status "origin/$BASE_BRANCH...origin/$HEAD_BRANCH"
git diff "origin/$BASE_BRANCH...origin/$HEAD_BRANCH"
git log --oneline "origin/$BASE_BRANCH..origin/$HEAD_BRANCH"
```
3. Map changed files by area:
- Frontend: `yyx-app/`
- Backend/Edge: `yyx-server/`
- Database: `yyx-server/supabase/migrations/`
- Infra/tooling: CI, config, scripts
- Docs: markdown and process files
4. Review against all 8 categories from `references/REVIEW-CRITERIA.md`:
   Architecture & Design, Correctness, Security, Performance, Code Quality, Testing, i18n, Hygiene (use "PR Hygiene" label).
5. Produce findings with severity (Critical / Warning / Suggestion) per the canonical definitions.
6. Derive recommendation per the PR context column in the recommendation logic table.

## Severity and Depth Rules

- Every finding must include: file path, line reference (when possible), concrete recommendation.
- `Critical` findings must include 2-3 options with tradeoffs:
  - effort
  - risk
  - impact on other code
  - maintenance burden
- `Warning` findings that materially affect merge risk should also include options/tradeoffs.
- For optioned findings, put the recommended option first and explain why.
- `Suggestion` findings can stay concise without option matrix.

## Review Rules

- Prioritize real, user-impacting issues over style nits.
- Always cite concrete evidence with file paths and lines when possible.
- Distinguish confirmed issues from assumptions or unknowns.
- Do not duplicate lint/type/test failures already fully covered by CI unless there is additional risk context.
- Keep recommendations tied to the PR objective and expected user impact.
- Call out potential blind spots explicitly when confidence is limited.
- Be constructive and explicitly acknowledge good patterns.

## Output Format

Use this structure:

````markdown
## PR Review: #<number> - <title>

**Author:** <author>
**Branch:** <head> -> <base>
**Scope:** <areas touched>

### CI Status
- Merge Gate: <pass/fail/pending>
- App CI: <pass/fail/pending/skipped>
- Server CI: <pass/fail/pending/skipped>
- PR Checks: <pass/fail/pending>

### Good Patterns Observed
- <specific pattern worth keeping>
- <specific pattern worth keeping>

### Findings
#### Architecture & Design
- [Warning] `path/to/file.ts:42` - <finding>
  - Recommendation: <specific recommendation>

#### Correctness
- [Critical] `path/to/file.ts:88` - <finding>
  - Recommendation: <specific recommendation>
  - Options:
    1. **A (Recommended)** <option> - Effort: <S/M/L>, Risk: <...>, Impact: <...>, Maintenance: <...>
    2. **B** <option> - Effort: <...>, Risk: <...>, Impact: <...>, Maintenance: <...>
    3. **C** <option> - Effort: <...>, Risk: <...>, Impact: <...>, Maintenance: <...>

#### Security
- [Critical] `path/to/file.sql:12` - <finding>
  - Recommendation: <specific recommendation>
  - Options:
    1. **A (Recommended)** <option> - Effort: <S/M/L>, Risk: <...>, Impact: <...>, Maintenance: <...>
    2. **B** <option> - Effort: <...>, Risk: <...>, Impact: <...>, Maintenance: <...>

#### Performance
- [Warning] `path/to/file.tsx:131` - <finding>
  - Recommendation: <specific recommendation>

#### Testing
- [Warning] `path/to/file.test.ts:1` - <gap>
  - Recommendation: <specific recommendation>

#### Conventions & Hygiene
- [Suggestion] `path/to/file.tsx:15` - <finding>
  - Recommendation: <specific recommendation>

#### Documentation
- [Suggestion] `path/to/file.md:18` - <finding>
  - Recommendation: <specific recommendation>

### Recommendations
| Rank | Recommendation | Impact | Complexity | Rationale |
|------|----------------|--------|------------|-----------|
| 1 | <feature improvement tied to PR goal and user value> | High | Medium | <reason> |
| 2 | <PR improvement tied to testing/docs/rollout/risk> | Medium | Low | <reason> |
| 3 | <maintainability improvement worth doing now> | Medium | Medium | <reason> |

### Potential Misses
- <what may have been missed and why it is uncertain>
- <what to validate manually or with targeted tests>

### Next-Step Agent Prompt
```text
You are the implementation agent for PR #<number>.

Objective:
- Improve this PR by fixing high-value findings and applying worthwhile recommendations while preserving the PR's intent.

Instructions:
1. Create an implementation plan first.
2. Prioritize items by impact, risk, and effort.
3. Implement only fixes/recommendations that are worth doing given the PR objective and context.
4. Skip low-value or out-of-scope changes; explain why they were deferred.
5. Run targeted validation (tests/checks) for changed areas.
6. Report: implemented items, deferred items, validation results, and any residual risks.

Constraints:
- Do not modify `.claude/`.
- Keep changes scoped to the PR objective.
- Avoid unrelated refactors.
```

### Summary
- Critical: <count>
- Warning: <count>
- Suggestion: <count>

**Recommendation:** <APPROVE | COMMENT | REQUEST CHANGES>
````

For a reusable invocation template, use `references/review-pr-prompt.md`.
