---
name: yummyyummix:review-pr
description: Review a pull request for code quality, correctness, security, testing, and project conventions
disable-model-invocation: true
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
- `docs/agent-guidelines/REVIEW-OUTPUT-SPEC.md` (canonical output sections, finding format, and Next Steps prompt contract)
- `CLAUDE.md` (architecture and key conventions)
- `docs/operations/TESTING.md` (test patterns and conventions)

### Step 4: Review Criteria

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

**Finding format** — Follow the format defined in `docs/agent-guidelines/REVIEW-OUTPUT-SPEC.md`:
- Every finding: severity tag, file path, line number (when possible), concrete description, specific recommendation.
- Critical findings: include 2-3 options with effort/risk/impact/maintenance tradeoffs. Recommended option first.
- Warning findings that affect merge risk: also include options/tradeoffs.
- Suggestion findings: concise, no option matrix needed.

**Documentation check:** Flag when the PR introduces or changes patterns that are documented in `CLAUDE.md`, `docs/agent-guidelines/`, or `docs/architecture/` but the docs weren't updated to match. Look for: new edge functions not listed, changed conventions, new components not added to directory maps, renamed files/directories with stale doc references. Severity: Suggestion for minor gaps, Warning for misleading docs.

### Step 4b: Prepare Additional Sections

After completing the review criteria evaluation, prepare material for these additional report sections:

**Highlights** — Acknowledge good patterns, clean implementations, or smart design choices in the PR. Good reviews are balanced — calling out what's done well provides useful context and encourages good practices. Examples: good use of existing utilities, clean separation of concerns, thorough error handling, well-structured commits.

**Recommendations** — High-value improvements **related to the PR but outside what was flagged in Findings**. These are opportunities the author may have missed, not a restatement of issues already found. Think about: adjacent code that could benefit from similar treatment, patterns elsewhere in the codebase worth adopting, opportunities this change opens up, missing tests for related (not just changed) code, documentation that would help future developers. **Do NOT repeat issues already listed in Findings.** Rank by impact vs effort. Format as a table with Rank, Recommendation, Impact, Effort, and Rationale columns.

**Potential Misses** — Areas this review may have missed or couldn't fully evaluate. Think about: Files you couldn't read, runtime behavior you can't verify from a diff, integration concerns, UX flows, accessibility, areas where the diff was too large to review thoroughly, transitive dependencies.

**Next Steps** — A self-contained prompt for an implementation agent, following the contract in `docs/agent-guidelines/REVIEW-OUTPUT-SPEC.md`. The prompt must:
1. List **every** finding from the review (all Critical, Warning, and Suggestion) with severity, file:line, and description
2. List Recommendations worth implementing
3. Instruct the agent to: read relevant files, create an implementation plan addressing all Critical/Warning findings plus selected Suggestions/Recommendations, implement the plan, run tests/validation
4. Be fully self-contained — executable without reading this review

### Step 5: Output the Report

Format findings as a structured report following `docs/agent-guidelines/REVIEW-OUTPUT-SPEC.md`:

````markdown
## PR Review: #<number> — <title>

**Author:** <author>
**Branch:** <head> → <base>
**Changes:** <file count> files | +<additions> -<deletions> (<areas touched>)

---

### CI Status

| Check | Status |
|-------|--------|
| Merge Gate | <pass/fail/pending> |
| App CI (Lint & TypeCheck) | <pass/fail/pending/skipped> |
| App CI (Test) | <pass/fail/pending/skipped> |
| Server CI (Format) | <pass/fail/pending/skipped> |
| Server CI (Unit Tests) | <pass/fail/pending/skipped> |
| PR Checks | <pass/fail/pending> |

---

### Highlights

- <good pattern acknowledged>

---

### Findings

#### Architecture & Design
- [severity] `file:line` — description
  - Recommendation: <specific recommendation>
  - Options: (Critical/merge-risk Warning only)
    1. **A (Recommended)** ... — Effort: S/M/L, Risk: ..., Impact: ..., Maintenance: ...
    2. **B** ... — Effort: ..., Risk: ..., Impact: ..., Maintenance: ...

#### Correctness
- [severity] `file:line` — description

#### Security
- [severity] `file:line` — description

#### Performance
- [severity] `file:line` — description

#### Code Quality
- [severity] `file:line` — description

#### Testing
- [severity] `file:line` — description

#### i18n
- [severity] `file:line` — description

#### PR Hygiene
- [severity] description

#### Documentation
- [severity] `file:line` — description

(Use *No issues found.* if a category is clean.)

---

### Summary

**Critical:** <count> — Must fix before merge
**Warning:** <count> — Should fix
**Suggestion:** <count> — Nice to have

**Recommendation:** <APPROVE / COMMENT / REQUEST CHANGES>

---

### Recommendations

| Rank | Recommendation | Impact | Effort | Rationale |
|------|----------------|--------|--------|-----------|
| 1 | <high-value improvement outside Findings> | High | Low | <reason> |
| 2 | <opportunity the PR opens up> | Medium | Medium | <reason> |

---

### Potential Misses

Areas this review may have missed or couldn't fully evaluate:
- <what may have been missed and why it is uncertain>

---

### Next Steps

```text
You are the implementation agent for PR #<number>.

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
- Keep changes scoped to the PR objective.
- Avoid unrelated refactors.
```
````
