---
name: yummyyummix:review-changes
description: Review local commits on the current branch for code quality, correctness, security, testing, and project conventions before opening a PR
disable-model-invocation: true
---

# Review Changes Skill

Review local commits on the current branch against YummyYummix project standards before opening a PR.

## Instructions

You are reviewing local commits for the YummyYummix codebase. This is a pre-PR self-review — same rigor as `yummyyummix:review-pr`, but oriented around "is this ready to become a PR?" instead of "should this merge?" Follow these steps exactly.

### Step 0: Determine Commit Scope

Determine the commit range to review based on `$ARGUMENTS` and the current branch.

```bash
# Get current branch
git rev-parse --abbrev-ref HEAD

# Get default branch name
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main"
```

Then select the range:

| Condition | Range |
|-----------|-------|
| No args + feature branch | `$(git merge-base HEAD <default-branch>)..HEAD` — all commits since branching |
| No args + main/master | `HEAD~1..HEAD` — last commit only |
| Numeric arg (e.g. `3`) | `HEAD~3..HEAD` — last N commits |
| Range arg (e.g. `abc..def`) | Use as-is |
| Single commit hash arg | `<hash>^..<hash>` — just that one commit |

If the range resolves to zero commits, stop and tell the user there are no commits to review.

### Step 1: Gather Commit Context

Run these `git` commands to collect all change information:

```bash
# Commit log with stats
git log --oneline --stat $RANGE

# Full diff
git diff $RANGE

# File change status (Added/Modified/Deleted/Renamed)
git diff --name-status $RANGE

# Change summary
git diff --stat $RANGE | tail -1

# Commit messages for conventional commit validation
git log --format="%H %s" $RANGE
```

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
- `docs/operations/TESTING.md` (test patterns and conventions)

### Step 4: Delegate Detailed File Review

Launch domain-specific agents in parallel to review files in their area of expertise. Route files by path:

**Domain-specific reviews** (launch in parallel via Task tool):
- **AI files** (`_shared/ai-gateway/`, `_shared/tools/`, `_shared/rag/`, orchestrators) → `yummyyummix:ai-engineer` — Ask it to review for gateway pattern violations, tool registry consistency, safety system gaps, and AI-specific issues. Pass the relevant file list and diff.
- **Database files** (`supabase/migrations/`) → `yummyyummix:database` — Ask it to review for missing RLS, naming convention violations, unsafe DDL, missing indexes, and rollback concerns. Pass the migration files and diff.
- **Backend files** (`yyx-server/` other than AI/migrations) → `yummyyummix:backend` — Ask it to review for edge function patterns, auth handling, error leakage, SSE streaming issues, and Deno conventions. Pass the relevant file list and diff.
- **Frontend files** (`yyx-app/`) → `yummyyummix:frontend` — Ask it to review for convention violations (@/ imports, Text/Button from common, design tokens, FlashList, expo-image, i18n), performance issues, and component architecture. Pass the relevant file list and diff.

Only launch agents for domains that have changed files. Tell each agent it is in **review mode** — read-only analysis, no code modifications.

**Cross-cutting review** (also launch in parallel):
- `yummyyummix:code-reviewer` — Still runs on ALL changed files for cross-cutting concerns: dead code, DRY violations, correctness bugs, type safety.

Review the diff output yourself for correctness, security, testing, i18n, and commit hygiene checks.

### Step 5: Review Criteria

Evaluate the changes against each of the 8 categories defined in `docs/agent-guidelines/REVIEW-CRITERIA.md`:

1. Architecture & Design
2. Correctness
3. Security
4. Performance
5. Code Quality
6. Testing
7. i18n
8. Hygiene (use "Commit Hygiene" label for this context)
9. Documentation

Apply the **Engineering Preferences** from that document throughout. Use the **Severity Levels** (Critical / Warning / Suggestion) and **Readiness Logic** (pre-PR context column) defined there.

**Documentation check:** Flag when changes introduce or modify patterns that are documented in `CLAUDE.md`, `docs/agent-guidelines/`, or `docs/architecture/` but the docs weren't updated to match. Look for: new edge functions not listed, changed conventions, new components not added to directory maps, renamed files/directories with stale doc references. Severity: Suggestion for minor gaps, Warning for misleading docs.

### Step 5b: Prepare Additional Sections

After completing the review criteria evaluation, prepare material for these additional report sections:

**Highlights** — Acknowledge good patterns, clean implementations, or smart design choices. This is a self-review, so constructive feedback matters. Examples: good use of existing utilities, clean separation of concerns, thorough error handling, well-structured commits.

**Suggestions & Improvements** — Concrete ideas to make the code better, ranked by impact-to-complexity ratio. Each should include an impact level (high/med/low) and effort level (high/med/low). These go beyond flagged issues — they're opportunities, not problems.

**Recommendations** — Actionable improvements beyond the findings. Think about: Could the feature be more robust? Are there edge cases not handled? Would additional documentation, tests, or error handling improve confidence? Are there patterns elsewhere in the codebase that these changes could adopt?

**Blind Spots** — Areas this review may have missed or couldn't fully evaluate. Think about: Files you couldn't read, runtime behavior you can't verify from a diff, integration concerns, UX flows, accessibility, areas where the diff was too large to review thoroughly, transitive dependencies.

**Next Steps prompt** — Synthesize findings + recommendations + suggestions into a single self-contained prompt that another AI coding agent could execute without reading this review. Include: the branch name, what to fix, what to improve, what files to touch, and the instruction to plan first then implement.

### Step 6: Output the Report

Format findings as a structured report:

```
## Review: <branch-name>

**Commits:** <count> (<first-sha>..<last-sha>)
**Branch:** <branch> (compared against <base>)
**Changes:** <file count> files | +<additions> -<deletions> (<areas touched>)

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

#### Commit Hygiene
- [severity] description

#### Documentation
- [severity] description — file:line

(Use *No issues found.* if a category is clean.)

---

### Summary

**Critical:** <count> — Must fix before PR
**Warning:** <count> — Should fix
**Suggestion:** <count> — Nice to have

**Readiness:** <READY FOR PR / NEEDS WORK / QUICK FIXES THEN PR>

---

### Suggestions & Improvements

1. **<title>** — <description>. *Impact: high/med/low, Effort: high/med/low*

---

### Recommendations

Actionable improvements beyond the findings above. These are suggestions to strengthen the code before opening a PR:
- <recommendation>

### Blind Spots

Areas this review may have missed or couldn't fully evaluate:
- <blind spot>

### Next Steps

<A ready-to-execute prompt for an AI coding agent that: (1) reads this review, (2) creates an implementation plan addressing the findings, recommendations, and suggestions worth acting on given the branch's context and objective, and (3) implements the plan. The prompt should reference specific files and findings by name.>
```
