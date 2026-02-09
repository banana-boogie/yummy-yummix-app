---
name: yummyyummix:review-pr
description: Review a pull request for code quality, security, testing, and project conventions
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

### Step 3: Delegate Detailed File Review

Use the **yummyyummix:code-reviewer** sub-agent (via the Task tool with `subagent_type: "yummyyummix:code-reviewer"`) to perform deep file-level analysis. Pass it the list of changed files and ask it to review against:
- Architecture & design fit
- Dead code & cleanup
- Performance issues
- Project convention violations

Read the diff output yourself for security, testing, and PR hygiene checks.

### Step 4: Review Criteria

Read the following project standards files for context:
- `AGENT.md` (testing requirements)
- `TESTING.md` (test patterns and conventions)
- `CLAUDE.md` (architecture and key conventions)
- `PR-REVIEW.md` (detailed review criteria and severity definitions)

Then evaluate the PR against each category below.

#### Architecture & Design
- **Fit**: Code in the right directories? (`app/` for screens, `components/` for UI, `services/` for data, `contexts/` for state, `hooks/` for custom hooks)
- **Quality**: Right design for the problem? Check separation of concerns, coupling, abstraction level (too much or too little), data flow clarity, pattern choice (context vs hook vs service, single component vs composition)

#### Dead Code & Cleanup
- Unused imports, variables, functions, exports
- Commented-out code blocks
- Stale TODO comments
- Redundant code from partial refactors
- Code made obsolete by the PR's own changes

#### Performance
- Missing `React.memo` on pure components
- Inline functions/objects in render causing re-renders
- Missing `useMemo`/`useCallback` for expensive operations
- N+1 query patterns in services
- Missing pagination for list queries
- `FlatList` that should be `FlashList`
- Raw `<Image>` that should be `expo-image`
- Large imports that could be lazy-loaded

#### Security
- New database tables missing RLS policies
- Missing input validation at system boundaries
- Exposed secrets or credentials in code
- SQL injection vectors
- XSS vulnerabilities in rendered content

#### Testing
Check against the AGENT.md requirements table:

| What You Create/Modify | Required Tests |
|------------------------|----------------|
| New component | Unit test (rendering, interactions, states) |
| New service function | Unit test with mocked dependencies |
| New Edge Function | Deno unit test |
| Bug fix | Regression test |
| Auth/security code | Tests for success AND failure paths |

Flag missing tests for critical code (auth, data mutations, user input, core components, business logic, edge functions).

#### Conventions
- i18n: No hardcoded user-facing strings; translations in both `en` and `es`
- Imports: Always use `@/` alias
- Text: Use `<Text>` from `@/components/common`, never React Native's `Text`
- Styling: Use design tokens from `constants/design-tokens.js`, no hardcoded colors/spacing
- Edge functions: CORS headers, auth validation, shared utilities in `_shared/`
- No `console.log` statements left in code
- Clean TypeScript (no `any` unless justified)

#### PR Hygiene
- Commit messages follow conventional commits format (`feat:`, `fix:`, `chore:`, `docs:`, etc.)
- PR has a type label (`feature`, `fix`, `chore`, `docs`, `refactor`, `test`)
- PR is a reasonable size (warn if >50 files or >1000 lines added)
- PR description explains the "why"

### Step 4b: Prepare Recommendations, Blind Spots, and Next Steps

After completing the review criteria evaluation, prepare material for three additional report sections:

**Recommendations** — Actionable improvements beyond the findings. Think about: Could the feature be more robust? Are there edge cases not handled? Would additional documentation, tests, or error handling improve confidence? Are there patterns elsewhere in the codebase that this PR could adopt?

**Blind Spots** — Areas this review may have missed or couldn't fully evaluate. Think about: Files you couldn't read, runtime behavior you can't verify from a diff, integration concerns, UX flows, accessibility, areas where the diff was too large to review thoroughly, transitive dependencies.

**Next Steps prompt** — Synthesize findings + recommendations into a single self-contained prompt that another AI coding agent could execute without reading this review. Include: the PR number and branch, what to fix, what to improve, what files to touch, and the instruction to plan first then implement.

### Step 5: Output the Report

Format findings as a structured report:

```
## PR Review: #<number> — <title>

**Author:** <author>
**Branch:** <head> → <base>
**Changes:** <file count> files (<areas touched>)

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

### Findings

#### Architecture & Design
- [severity] description

#### Dead Code & Cleanup
- [severity] description

#### Performance
- [severity] description

#### Security
- [severity] description

#### Testing
- [severity] description

#### Conventions
- [severity] description

#### PR Hygiene
- [severity] description

---

### Summary

**Critical:** <count> — Must fix before merge
**Warning:** <count> — Should fix
**Suggestion:** <count> — Nice to have

**Recommendation:** <APPROVE / REQUEST CHANGES / COMMENT>

---

### Recommendations

Actionable improvements beyond the findings above. These are suggestions to strengthen the feature or PR, not issues that need fixing:
- <recommendation>

### Blind Spots

Areas this review may have missed or couldn't fully evaluate:
- <blind spot>

### Next Steps

<A ready-to-execute prompt for an AI coding agent that: (1) reads this review, (2) creates an implementation plan addressing the findings and recommendations worth acting on given the PR's context and objective, and (3) implements the plan. The prompt should reference specific files and findings by name.>
```

### Severity Levels

Tag each finding with one of:
- **Critical** — Must fix before merge. Bugs, security issues, broken CI, missing RLS on new tables, missing tests for auth/security code.
- **Warning** — Should fix, ideally before merge. Performance issues, missing tests for new features, convention violations that affect maintainability.
- **Suggestion** — Nice to have. Minor style preferences, optional optimizations, documentation improvements.

### Recommendation Logic

- Any **Critical** findings → **REQUEST CHANGES**
- 3+ **Warning** findings → **REQUEST CHANGES**
- 1-2 **Warning** findings → **COMMENT** (with note to address warnings)
- Only **Suggestion** findings or clean → **APPROVE**
