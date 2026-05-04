---
name: review-pr
description: Review a pull request for code quality, correctness, security, testing, and project conventions
---

# PR Review Skill

Review pull request #$ARGUMENTS against YummyYummix project standards.

## Instructions

You are reviewing a pull request for the YummyYummix codebase. Follow these steps exactly.

### Step 1: Gather PR Context

Run these `gh` commands to collect all PR information:

```bash
# PR metadata (use --json to avoid classic projects API error)
gh pr view $ARGUMENTS --json title,author,headRefName,baseRefName,body,labels,changedFiles,additions,deletions,state,number

# Full diff
gh pr diff $ARGUMENTS

# CI check status
gh pr checks $ARGUMENTS

# Commit list for conventional commit validation
gh pr view $ARGUMENTS --json commits --jq '.commits[].messageHeadline'
```

If `$ARGUMENTS` is empty or not a number, ask the user for the PR number.

### Step 2: Categorize Changes

Group the changed files from the diff into these areas:
- **Frontend** (`yyx-app/`) — React Native app changes
- **Backend** (`yyx-server/`) — Edge Functions and server changes
- **Database** (`yyx-server/supabase/migrations/`) — Schema migrations
- **Infrastructure** (`.github/`, config files) — CI/CD and tooling
- **Documentation** (`*.md`) — Docs changes

### Step 3: Read Project Standards

Read the following project standards files for context:
- `docs/agent-guidelines/REVIEW-CRITERIA.md` (canonical review criteria, categories, severity, and recommendation logic)
- `docs/agent-guidelines/REVIEW-OUTPUT-SPEC.md` (canonical output format — two-tier: human summary + AI handoff)
- `CLAUDE.md` (architecture and key conventions)
- `docs/operations/TESTING.md` (test patterns and conventions)

### Step 4: Full Internal Review

Evaluate the PR against each of the 9 categories defined in `docs/agent-guidelines/REVIEW-CRITERIA.md`:

1. Architecture & Design
2. Correctness
3. Security
4. Performance
5. Code Quality
6. Testing
7. i18n
8. Hygiene (use "PR Hygiene" label for this context)
9. Documentation

Apply the **Engineering Preferences** from that document throughout. Use the **Severity Levels** (Critical / Warning / Suggestion) and **Recommendation Logic** (PR context column) defined there.

For every finding, capture internally:
- Severity tag, file path, line number (when possible), concrete description, specific recommendation.
- Critical findings: 2-3 options with effort/risk/impact/maintenance tradeoffs.
- Warning findings that affect merge risk: also include options/tradeoffs.

Also prepare:
- **Highlights** — Good patterns, clean implementations, smart design choices.
- **Potential Misses** — Areas the review couldn't fully evaluate.

For Suggestion-level findings: only include ones you actively recommend. If a suggestion isn't worth doing, omit it entirely.

**Documentation check:** Flag when the PR introduces or changes patterns that are documented in `CLAUDE.md`, `docs/agent-guidelines/`, or `docs/architecture/` but the docs weren't updated to match.

### Step 5: Output the Report

The report has **two sections**: a short human-readable summary, and a detailed Next Steps prompt for the implementing AI.

**Keep the human section short and scannable. Put all the detail in Next Steps.**

````markdown
## PR Review: #<number> — <title>

**Branch:** <head> → <base> | <file count> files | +<additions> -<deletions>

### CI Status
- Merge Gate: <pass/fail/pending>
- App CI: <pass/fail/pending/skipped>
- Server CI: <pass/fail/pending/skipped>

### Verdict

**<APPROVE / COMMENT / REQUEST CHANGES>** — <critical count> critical, <warning count> warnings, <suggestion count> suggestions

### Highlights

- <good pattern acknowledged>
- <good pattern acknowledged>

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
You are the implementation agent for PR #<number>.

## Review Findings — Fix All

Finding numbers (#N) match the "Issues at a Glance" table in the review.

### Critical
- **#1** [Critical] `file:line` — description
  - Recommendation: <specific recommendation>
  - Options:
    1. **A (Recommended)** <option> — Effort: S/M/L, Risk: <...>, Impact: <...>
    2. **B** <option> — Effort: S/M/L, Risk: <...>, Impact: <...>

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
- Keep changes scoped to the PR objective.
- Avoid unrelated refactors.
```
````
