---
name: yummyyummix:review-pr
description: Review pull requests for architecture, correctness, security, testing coverage, performance, and project conventions. Use when asked to evaluate a GitHub PR (number or URL), summarize merge risk, or provide an approve/comment/request-changes recommendation.
---

# PR Review

## Overview

Review one pull request end-to-end and return clear, prioritized findings with a final merge recommendation.

## Required Inputs

- PR number or URL
- Repository with GitHub CLI access (`gh`)
- Optional review focus (for example: security, testing, performance)

If the PR identifier is missing or is not a PR number/URL, ask for a valid PR number or URL before continuing.

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
- Database: `supabase/migrations/`
- Infra/tooling: CI, config, scripts
- Docs: markdown and process files
4. Review for defects and risk:
- Architecture and design fit
- Correctness and regression risk
- Security issues (RLS, auth checks, input validation, secrets)
- Performance concerns (re-renders, query patterns, list/image handling)
- Test gaps against changed behavior
- Documentation quality (comments for complex logic, PR docs/README/API updates where needed)
- Conventions (`@/` imports, i18n, tokens, no stray `console.log`)
- PR hygiene (conventional commits, labels, size, PR rationale)
5. Produce findings with severity:
- `Critical`: must fix before merge
- `Warning`: should fix
- `Suggestion`: nice to have
6. Derive recommendation:
- Any `Critical` => `REQUEST CHANGES`
- 3+ `Warning` => `REQUEST CHANGES`
- 1-2 `Warning` => `COMMENT`
- Only `Suggestion` or none => `APPROVE`

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
