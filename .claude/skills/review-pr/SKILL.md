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
- **Database** (`supabase/migrations/`) — Schema migrations
- **Infrastructure** (`.github/`, config files) — CI/CD and tooling
- **Documentation** (`*.md`) — Docs changes

### Step 3: Read Project Standards

Read the following project standards files for context:
- `docs/agent-guidelines/REVIEW-CRITERIA.md` (canonical review criteria, categories, severity, and recommendation logic)
- `CLAUDE.md` (architecture and key conventions)
- `TESTING.md` (test patterns and conventions)

### Step 4: Delegate Detailed File Review

Use the **yummyyummix:code-reviewer** sub-agent (via the Task tool with `subagent_type: "yummyyummix:code-reviewer"`) to perform deep file-level analysis. Pass it the list of changed files and ask it to review against:
- Architecture & design fit
- Correctness (bugs, edge cases, error handling, race conditions, type safety)
- Dead code & cleanup
- Performance issues
- Project convention violations

Read the diff output yourself for security, testing, i18n, and PR hygiene checks.

### Step 5: Review Criteria

Evaluate the PR against each of the 8 categories defined in `docs/agent-guidelines/REVIEW-CRITERIA.md`:

1. Architecture & Design
2. Correctness
3. Security
4. Performance
5. Code Quality
6. Testing
7. i18n
8. Hygiene (use "PR Hygiene" label for this context)

Apply the **Engineering Preferences** from that document throughout. Use the **Severity Levels** (Critical / Warning / Suggestion) and **Recommendation Logic** (PR context column) defined there.

### Step 5b: Prepare Additional Sections

After completing the review criteria evaluation, prepare material for these additional report sections:

**Highlights** — Acknowledge good patterns, clean implementations, or smart design choices in the PR. Good reviews are balanced — calling out what's done well provides useful context and encourages good practices. Examples: good use of existing utilities, clean separation of concerns, thorough error handling, well-structured commits.

**Suggestions & Improvements** — Concrete ideas to make the code better, ranked by impact-to-complexity ratio. Each should include an impact level (high/med/low) and effort level (high/med/low). These go beyond flagged issues — they're opportunities, not problems.

**Recommendations** — Actionable improvements beyond the findings. Think about: Could the feature be more robust? Are there edge cases not handled? Would additional documentation, tests, or error handling improve confidence? Are there patterns elsewhere in the codebase that this PR could adopt?

**Blind Spots** — Areas this review may have missed or couldn't fully evaluate. Think about: Files you couldn't read, runtime behavior you can't verify from a diff, integration concerns, UX flows, accessibility, areas where the diff was too large to review thoroughly, transitive dependencies.

**Next Steps prompt** — Synthesize findings + recommendations + suggestions into a single self-contained prompt that another AI coding agent could execute without reading this review. Include: the PR number and branch, what to fix, what to improve, what files to touch, and the instruction to plan first then implement.

### Step 6: Output the Report

Format findings as a structured report:

```
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
- [severity] description — file:line

#### Correctness
- [severity] description — file:line

#### Security
- [severity] description — file:line

#### Performance
- [severity] description — file:line

#### Code Quality
- [severity] description — file:line

#### Testing
- [severity] description — file:line

#### i18n
- [severity] description — file:line

#### PR Hygiene
- [severity] description

(Use *No issues found.* if a category is clean.)

---

### Summary

**Critical:** <count> — Must fix before merge
**Warning:** <count> — Should fix
**Suggestion:** <count> — Nice to have

**Recommendation:** <APPROVE / REQUEST CHANGES / COMMENT>

---

### Suggestions & Improvements

1. **<title>** — <description>. *Impact: high/med/low, Effort: high/med/low*

---

### Recommendations

Actionable improvements beyond the findings above. These are suggestions to strengthen the feature or PR, not issues that need fixing:
- <recommendation>

### Blind Spots

Areas this review may have missed or couldn't fully evaluate:
- <blind spot>

### Next Steps

<A ready-to-execute prompt for an AI coding agent that: (1) reads this review, (2) creates an implementation plan addressing the findings, recommendations, and suggestions worth acting on given the PR's context and objective, and (3) implements the plan. The prompt should reference specific files and findings by name.>
```
