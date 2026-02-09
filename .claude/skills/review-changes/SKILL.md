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
- `CLAUDE.md` (architecture and key conventions)
- `TESTING.md` (test patterns and conventions)

These contain the conventions and testing requirements referenced throughout the review criteria.

### Step 4: Delegate Detailed File Review

Use the **yummyyummix:code-reviewer** sub-agent (via the Task tool with `subagent_type: "yummyyummix:code-reviewer"`) to perform deep file-level analysis. Pass it the list of changed files and ask it to review against:
- Architecture & design fit
- Dead code & cleanup
- Performance issues
- Project convention violations

Review the diff output yourself for correctness, security, testing, i18n, and commit hygiene checks.

### Step 5: Review Criteria

Evaluate the changes against each category below. Apply these engineering preferences throughout:

- **Flag DRY violations aggressively** — even 2-3 repeated lines of similar logic warrant a finding
- **Flag both over- and under-engineering** — premature abstractions are as bad as duplicated logic
- **Bias toward more edge case handling** — missing error handling and unhandled states should be flagged
- **Prefer explicit over clever** — complex one-liners, obscure patterns, and implicit behavior are worth flagging
- **Missing tests for critical code = Warning or Critical**, not Suggestion

#### Architecture & Design
- **Fit**: Code in the right directories? (`app/` for screens, `components/` for UI, `services/` for data, `contexts/` for state, `hooks/` for custom hooks)
- **Quality**: Right design for the problem? Check separation of concerns, coupling, abstraction level (too much or too little), data flow clarity, pattern choice (context vs hook vs service, single component vs composition)
- **DRY**: Duplicated logic across files or within the same file? Similar patterns that should be extracted into a shared utility, hook, or component?

#### Correctness
- **Bugs**: Logic errors, off-by-one, wrong comparisons, incorrect assumptions
- **Edge cases**: Null/undefined handling, empty arrays, boundary values, missing default cases
- **Error handling**: Unhandled promise rejections, missing try/catch, swallowed errors, missing user feedback on failure
- **Race conditions**: Stale closures, unmounted component state updates, concurrent data mutations
- **Type safety**: Incorrect type assertions, unsafe casts, types that don't match runtime values

#### Security
- New database tables missing RLS policies
- Missing input validation at system boundaries
- Exposed secrets or credentials in code
- SQL injection vectors
- XSS vulnerabilities in rendered content

#### Performance
- Missing `React.memo` on pure components
- Inline functions/objects in render causing re-renders
- Missing `useMemo`/`useCallback` for expensive operations
- N+1 query patterns in services
- Missing pagination for list queries
- `FlatList` that should be `FlashList`
- Raw `<Image>` that should be `expo-image`
- Large imports that could be lazy-loaded

#### Code Quality
- **Dead code**: Unused imports, variables, functions, exports, commented-out blocks, stale TODOs
- **Conventions**: `@/` imports, `<Text>` from common, design tokens (no hardcoded colors/spacing), no `console.log`, clean TypeScript (no `any`), `FlashList` for lists, `expo-image` for images, `React.memo` for pure components, edge function patterns (CORS, auth, `_shared/`)
- **DRY violations**: Repeated logic, copy-pasted blocks, patterns that should be shared
- **Naming**: Unclear variable/function names, misleading names, inconsistent naming patterns

#### Testing
Check against the AGENT.md requirements table:

| What You Create/Modify | Required Tests |
|------------------------|----------------|
| New component | Unit test (rendering, interactions, states) |
| New service function | Unit test with mocked dependencies |
| New Edge Function | Deno unit test |
| Bug fix | Regression test |
| Auth/security code | Tests for success AND failure paths |

Flag missing tests for critical code (auth, data mutations, user input, core components, business logic, edge functions). Missing tests for critical code should be **Warning** or **Critical**, not Suggestion.

#### i18n
- Hardcoded user-facing strings that should use `i18n.t()`
- Missing translations in either `en` or `es`
- Translation keys added to one language but not the other

#### Commit Hygiene
- Commit messages follow conventional commits format (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:` with optional scope)
- Each commit is focused on a single concern (not mixing unrelated changes)

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

### Severity Levels

Tag each finding with one of:
- **Critical** — Must fix before PR. Bugs, security issues, missing RLS on new tables, missing tests for auth/security code, data loss risk.
- **Warning** — Should fix before PR. Performance issues, missing tests for new features, convention violations that affect maintainability, missing error handling for likely edge cases.
- **Suggestion** — Nice to have. Minor style preferences, optional optimizations, documentation improvements.

### Readiness Logic

| Findings | Readiness |
|----------|-----------|
| Any **Critical** | **NEEDS WORK** |
| 3+ **Warning** | **NEEDS WORK** |
| 1-2 **Warning** | **QUICK FIXES THEN PR** |
| Only **Suggestion** or clean | **READY FOR PR** |
