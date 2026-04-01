---
name: yummyyummix:review-changes
description: Review local commits on the current branch for code quality, correctness, security, testing, and project conventions before opening a PR
disable-model-invocation: true
---

# Review Changes Skill

Review local commits on the current branch against YummyYummix project standards before opening a PR.

## Instructions

You are reviewing local commits for the YummyYummix codebase. This is a pre-PR self-review — same rigor as `yummyyummix:review-pr`, but oriented around "is this ready to become a PR?" Follow these steps exactly.

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

Evaluate the changes against each of the 9 categories defined in `docs/agent-guidelines/REVIEW-CRITERIA.md`:

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

For every finding, capture internally:
- Severity tag, file path, line number (when possible), concrete description, specific recommendation.
- Critical findings: 2-3 options with effort/risk/impact/maintenance tradeoffs.
- Warning findings that affect readiness: also include options/tradeoffs.

Also prepare:
- **Highlights** — Good patterns, clean implementations, smart design choices.
- **Recommendations** — High-value improvements related to the changes but outside Findings. Do NOT repeat findings.
- **Potential Misses** — Areas the review couldn't fully evaluate.

**Documentation check:** Flag when changes introduce or modify patterns that are documented in `CLAUDE.md`, `docs/agent-guidelines/`, or `docs/architecture/` but the docs weren't updated to match.

### Step 5: Output the Report

The report has **two sections**: a short human-readable summary, and a detailed Next Steps prompt for the implementing AI.

**Keep the human section short and scannable. Put all the detail in Next Steps.**

````markdown
## Review: <branch-name>

**Commits:** <count> (<first-sha>..<last-sha>) | <file count> files | +<additions> -<deletions>

### Verdict

**<READY FOR PR / QUICK FIXES THEN PR / NEEDS WORK>** — <critical count> critical, <warning count> warnings, <suggestion count> suggestions

### Highlights

- <good pattern acknowledged>
- <good pattern acknowledged>

### Issues

**Must fix**
- [Critical] `file:line` — one-sentence description
- [Warning] `file:line` — one-sentence description

**Nice to have**
- [Suggestion] `file:line` — one-sentence description

---

### Next Steps

> Copy-paste the prompt below to the implementing AI.

```text
You are the implementation agent for branch <branch-name>.

## Review Findings — Fix All

### Critical
- [Critical] `file:line` — description
  - Recommendation: <specific recommendation>
  - Options:
    1. **A (Recommended)** <option> — Effort: S/M/L, Risk: <...>, Impact: <...>
    2. **B** <option> — Effort: S/M/L, Risk: <...>, Impact: <...>

### Warning
- [Warning] `file:line` — description
  - Recommendation: <specific recommendation>

## Suggestions — Implement If Worthwhile

- [Suggestion] `file:line` — description. Recommendation: <what to do>

## Recommendations — Implement If Worthwhile

| Rank | Recommendation | Impact | Effort |
|------|----------------|--------|--------|
| 1 | <high-value improvement outside Findings> | High | Low |

## Potential Misses

Areas the review couldn't fully evaluate:
- <what was uncertain and why>

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
