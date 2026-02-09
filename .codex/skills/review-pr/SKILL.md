---
name: review-pr
description: Review pull requests for architecture, correctness, security, testing coverage, performance, and project conventions. Use when asked to evaluate a GitHub PR (number, URL, or branch diff), summarize merge risk, or provide an approve/comment/request-changes recommendation.
---

# PR Review

## Overview

Review one pull request end-to-end and return clear, prioritized findings with a final merge recommendation.

## Required Inputs

- PR number, URL, or branch reference
- Repository with GitHub CLI access (`gh`)
- Optional review focus (for example: security, testing, performance)

If the PR identifier is missing, ask for it before continuing.

## Workflow

1. Gather context:
```bash
gh pr view <pr>
gh pr diff <pr>
gh pr checks <pr>
gh pr view <pr> --json commits --jq '.commits[].messageHeadline'
```
2. Map changed files by area:
- Frontend: `yyx-app/`
- Backend/Edge: `yyx-server/`
- Database: `yyx-server/db/migrations/` or `supabase/migrations/`
- Infra/tooling: CI, config, scripts
- Docs: markdown and process files
3. Review for defects and risk:
- Architecture and design fit
- Correctness and regression risk
- Security issues (RLS, auth checks, input validation, secrets)
- Performance concerns (re-renders, query patterns, list/image handling)
- Test gaps against changed behavior
- Conventions (`@/` imports, i18n, tokens, no stray `console.log`)
- PR hygiene (conventional commits, labels, size, PR rationale)
4. Produce findings with severity:
- `Critical`: must fix before merge
- `Warning`: should fix
- `Suggestion`: nice to have
5. Derive recommendation:
- Any `Critical` => `REQUEST CHANGES`
- 3+ `Warning` => `REQUEST CHANGES`
- 1-2 `Warning` => `COMMENT`
- Only `Suggestion` or none => `APPROVE`

## Review Rules

- Prioritize real, user-impacting issues over style nits.
- Always cite concrete evidence with file paths and lines when possible.
- Distinguish confirmed issues from assumptions or unknowns.
- Do not duplicate lint/type/test failures already fully covered by CI unless there is additional risk context.

## Output Format

Use this structure:

```markdown
## PR Review: #<number> - <title>

**Author:** <author>
**Branch:** <head> -> <base>
**Scope:** <areas touched>

### CI Status
- Merge Gate: <pass/fail/pending>
- App CI: <pass/fail/pending/skipped>
- Server CI: <pass/fail/pending/skipped>
- PR Checks: <pass/fail/pending>

### Findings
#### Architecture & Design
- [Warning] `path/to/file.ts:42` - <finding>

#### Correctness
- [Critical] `path/to/file.ts:88` - <finding>

#### Security
- [Critical] `path/to/file.sql:12` - <finding>

#### Performance
- [Warning] `path/to/file.tsx:131` - <finding>

#### Testing
- [Warning] `path/to/file.test.ts:1` - <gap>

#### Conventions & Hygiene
- [Suggestion] `path/to/file.tsx:15` - <finding>

### Summary
- Critical: <count>
- Warning: <count>
- Suggestion: <count>

**Recommendation:** <APPROVE | COMMENT | REQUEST CHANGES>
```

For a reusable invocation template, use `references/review-pr-prompt.md`.
