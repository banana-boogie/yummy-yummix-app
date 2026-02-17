# PR Review Process

How pull requests are reviewed in the YummyYummix project. This document covers the automated `/yummyyummix:review-pr` skill, all review criteria, and the manual review checklist.

---

## Quick Start

```
/yummyyummix:review-pr 7
```

This runs the PR review skill, which gathers PR context via `gh` CLI, analyzes the diff against project standards, and produces a structured report.

---

## What the Skill Does

1. **Gathers context** — PR metadata, full diff, CI check status, and commit messages via `gh` CLI
2. **Categorizes changes** — Groups files by area (frontend, backend, database, infrastructure, docs)
3. **Reviews code** — Checks against all criteria below, delegating file-level analysis to the `yummyyummix:code-reviewer` sub-agent
4. **Produces a report** — Structured findings tagged by severity with a merge recommendation

---

## Engineering Preferences

These preferences calibrate reviewer behavior across all categories:

- **Flag DRY violations aggressively** — even 2-3 repeated lines of similar logic warrant a finding
- **Flag both over- and under-engineering** — premature abstractions are as bad as duplicated logic
- **Bias toward more edge case handling** — missing error handling and unhandled states should be flagged
- **Prefer explicit over clever** — complex one-liners, obscure patterns, and implicit behavior are worth flagging
- **Missing tests for critical code = Warning or Critical**, not Suggestion

---

## Review Criteria

> **Canonical source:** [`docs/agent-guidelines/REVIEW-CRITERIA.md`](../../agent-guidelines/REVIEW-CRITERIA.md). If criteria diverge, the canonical file is authoritative.

### Architecture & Design

Three layers of review:

**Fit** — Is code in the right place?

| Code Type | Correct Location |
|-----------|-----------------|
| Screens / routes | `yyx-app/app/` |
| Reusable UI components | `yyx-app/components/` (with subdirectory and `index.ts`) |
| Core shared components | `yyx-app/components/common/` |
| Layout components | `yyx-app/components/layouts/` |
| Data access / API calls | `yyx-app/services/` |
| React contexts | `yyx-app/contexts/` |
| Custom hooks | `yyx-app/hooks/` |
| TypeScript types | `yyx-app/types/` |
| Shared edge function utils | `yyx-server/supabase/functions/_shared/` |

Never put components, types, or business logic directly in `app/`.

**Quality** — Is this the right design for the problem?

- **Separation of concerns**: UI logic in components, data logic in services, state management in contexts/hooks
- **Coupling**: A change in one module shouldn't ripple into many others
- **Abstraction level**: Flag both over-engineering (premature abstractions, unnecessary indirection) and under-engineering (duplicated logic)
- **Data flow**: Clear path from data source to UI. Watch for prop drilling that should be context, or context that should just be a prop
- **Pattern choice**: Is context vs hook vs service the right tool? Single component vs composition? Shared utility vs inline code?
- **Simpler alternatives**: Could the same result be achieved more straightforwardly?

**DRY** — Is logic duplicated?

- Duplicated logic across files or within the same file
- Similar patterns that should be extracted into a shared utility, hook, or component
- Copy-pasted blocks with minor variations

### Correctness

- **Bugs**: Logic errors, off-by-one, wrong comparisons, incorrect assumptions
- **Edge cases**: Null/undefined handling, empty arrays, boundary values, missing default cases
- **Error handling**: Unhandled promise rejections, missing try/catch, swallowed errors, missing user feedback on failure
- **Race conditions**: Stale closures, unmounted component state updates, concurrent data mutations
- **Type safety**: Incorrect type assertions, unsafe casts, types that don't match runtime values

### Performance

- **Missing `React.memo`**: Pure components that receive complex props and render frequently
- **Inline closures in render**: `onPress={() => handler(id)}` inside list items causes re-renders. Extract to stable references
- **Inline objects in render**: `style={{ padding: 10 }}` creates new object each render
- **Missing memoization**: `useMemo` for expensive computations, `useCallback` for stable function references passed as props
- **N+1 queries**: Fetching related data in a loop instead of using joins or batch queries
- **Missing pagination**: `.select('*')` without `.range()` or `.limit()` on potentially large tables
- **FlatList vs FlashList**: `FlatList` should be `FlashList` for large or dynamic lists
- **Image optimization**: Raw `<Image>` should be `expo-image` for caching and progressive loading
- **Bundle size**: Large library imports that could be tree-shaken or lazy-loaded

### Security

- **RLS policies**: Every new database table MUST have Row Level Security policies. This is a Critical finding if missing
- **Input validation**: Validate user input at system boundaries (forms, API endpoints, edge functions)
- **Exposed secrets**: No API keys, tokens, or credentials in code or committed config files
- **SQL injection**: Parameterized queries only, no string interpolation in SQL
- **XSS**: Sanitize any user-generated content before rendering

### Testing

Based on the [AGENTS.md](../../../AGENTS.md) requirements table:

| What You Create/Modify | Required Tests |
|------------------------|----------------|
| New component | Unit test covering rendering, interactions, states |
| New service function | Unit test with mocked dependencies |
| New Edge Function | Deno unit test + update integration tests |
| Bug fix | Regression test that would have caught the bug |
| Auth/security code | Comprehensive tests for success AND failure paths |

**Always test (critical code):**
- Authentication (login, logout, session management, protected routes)
- Data mutations (create, update, delete)
- User input validation (forms, search, filters)
- Core components (Button, Text, Input, Modal, Form)
- Business logic (calculations, conversions, scoring)
- Edge Functions (all serverless functions)

**Optional tests (non-critical):**
- Pure presentational components with no logic
- Static pages
- Simple wrappers around library components

Missing tests for critical code should be **Warning** or **Critical**, not Suggestion.

### Code Quality

**Dead code**
- Unused imports, variables, functions, exports
- Commented-out code (should be deleted — Git preserves history)
- Stale `TODO`/`FIXME`/`HACK` comments referencing completed or abandoned work
- Partial refactor leftovers (old implementation left alongside new one)
- Code made redundant by the PR's own changes

**Conventions**

| Convention | Rule |
|-----------|------|
| **Imports** | Always use `@/` alias. Never relative paths like `../../` |
| **Text component** | Always `<Text>` from `@/components/common`. Never React Native's `Text` |
| **Button component** | `<Button>` from `@/components/common` with `variant` and `size` props |
| **Styling** | NativeWind with design tokens from `constants/design-tokens.js`. No hardcoded colors or pixel values |
| **Layouts** | Use `PageLayout` and `ResponsiveLayout` from `@/components/layouts/` |
| **Edge functions** | CORS headers, auth validation from `_shared/`, follow existing patterns |
| **Console logs** | No `console.log` in production code |
| **TypeScript** | No `any` unless explicitly justified |
| **Lists** | `FlashList` for long lists |
| **Images** | `expo-image` for all images |
| **Pure components** | `React.memo` for components that don't need re-renders |

**DRY violations**
- Repeated logic, copy-pasted blocks, patterns that should be shared
- Even 2-3 repeated lines of similar logic warrant a finding

**Naming**
- Unclear variable/function names, misleading names, inconsistent naming patterns

### i18n

- Hardcoded user-facing strings that should use `i18n.t()`
- Missing translations in either `en` or `es`
- Translation keys added to one language but not the other

### PR Hygiene

- **Conventional commits**: Messages follow `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:` format with optional scope
- **Type label**: PR has one of: `feature`, `fix`, `chore`, `docs`, `refactor`, `test`
- **Size**: Warn if >50 files changed or >1000 lines added. Suggest splitting
- **Description**: PR body explains the "why", not just the "what"

---

## Severity Levels

### Critical
Must fix before merge. Examples:
- Bugs or broken functionality
- Security vulnerabilities (missing RLS, exposed secrets, injection)
- Broken CI checks
- Missing tests for auth/security code
- Data loss risk

### Warning
Should fix, ideally before merge. Examples:
- Performance issues (missing memoization, N+1 queries)
- Missing tests for new features
- Convention violations that affect maintainability
- Missing error handling for likely edge cases
- Dead code that adds confusion

### Suggestion
Nice to have. Examples:
- Minor style preferences beyond what linters catch
- Optional performance optimizations
- Documentation improvements
- Code organization preferences

---

## Merge Recommendation

| Findings | Recommendation |
|----------|---------------|
| Any **Critical** | REQUEST CHANGES |
| 3+ **Warning** | REQUEST CHANGES |
| 1-2 **Warning** | COMMENT (note to address warnings) |
| Only **Suggestion** or clean | APPROVE |

---

## Highlights, Recommendations, Potential Misses & Next Steps

Every review report includes these sections after the findings summary. They add context that findings alone can't provide.

### Highlights

Acknowledge good patterns, clean implementations, or smart design choices in the PR. Good reviews are balanced — calling out what's done well provides useful context and encourages good practices.

Examples:
- "Clean separation between the recipe parsing service and the UI components"
- "Good use of the existing `useDebounce` hook for search input"
- "Well-structured conventional commits that make the PR easy to follow"

### Recommendations

High-value improvements related to the PR but outside what was flagged in Findings. These are opportunities the author may have missed, not a restatement of issues already found. Ranked by impact vs effort.

Examples:
- "**Extract recipe card skeleton** — The loading placeholder is duplicated in 3 list screens. *Impact: med, Effort: low*"
- "**Add optimistic updates to favorites** — Would make the UI feel instant. *Impact: high, Effort: med*"
- "Add an integration test for the new edge function to catch regressions at the API boundary"
- "The recipe scoring logic could reuse the existing `calculateNutritionScore` utility in `services/nutritionService`"

### Potential Misses

Honest acknowledgment of what the review couldn't fully evaluate. Helps the author know where to focus their own attention.

Examples:
- "Could not verify runtime behavior of the new animation — only reviewed the code statically"
- "The diff for `recipeService.ts` was 400+ lines; may have missed subtle issues in the middle sections"
- "No visibility into how the new RLS policy interacts with the existing `user_recipes` policy"
- "Accessibility (screen reader, VoiceOver) not evaluated"

### Next Steps

A ready-to-execute prompt for an AI coding agent. The prompt should be self-contained — another agent should be able to act on it without reading the full review. It includes:
- The PR number and branch
- What findings to fix (by name and file)
- What recommendations are worth pursuing
- What files to modify
- The instruction to plan before implementing

This section creates a direct handoff from review to implementation.

---

## CI Checks Reference

These checks run automatically on every PR. The review skill reports their status but does not duplicate their work.

| Check | Workflow | What It Validates |
|-------|----------|-------------------|
| **Merge Gate** | `merge-gate.yml` | Aggregates all required checks. Only required branch protection check. Dynamically determines which CI jobs must pass based on changed files |
| **App CI — Lint & TypeCheck** | `yyx-app-ci.yml` | ESLint rules, TypeScript type checking (typecheck is non-blocking until cleanup) |
| **App CI — Test** | `yyx-app-ci.yml` | Jest unit tests with coverage report |
| **Server CI — Format** | `yyx-server-ci.yml` | Deno format check |
| **Server CI — Unit Tests** | `yyx-server-ci.yml` | Deno unit tests with coverage |
| **Server CI — Integration** | `yyx-server-ci.yml` | Integration tests against staging (PR only, requires secrets) |
| **PR Checks — Info** | `pr-checks.yml` | PR summary, changed file counts by area |
| **PR Checks — Size** | `pr-checks.yml` | Warns if PR is too large (>50 files or >1000 additions) |
| **PR Checks — Labels** | `pr-checks.yml` | Checks for required type label |

### What CI Catches vs What the Review Skill Catches

| Concern | CI | Review Skill |
|---------|----|----|
| Lint errors | Yes | No (trusts CI) |
| Type errors | Yes | No (trusts CI) |
| Test failures | Yes | No (trusts CI) |
| Format issues | Yes | No (trusts CI) |
| PR size | Yes | Reports CI result |
| Labels | Yes | Reports CI result |
| Architecture fit | No | Yes |
| Design quality | No | Yes |
| Correctness (bugs, edge cases) | No | Yes |
| Code quality (dead code, DRY, naming) | No | Yes |
| Performance | No | Yes |
| Security (RLS, secrets) | No | Yes |
| Test coverage gaps | No | Yes |
| i18n (translations) | No | Yes |
| Convention violations | Partial (lint) | Yes (full) |
| Commit message format | No | Yes |

---

## Manual Review Checklist

For cases where a human wants to follow the same criteria without the skill:

### Before reviewing
- [ ] Read the PR description
- [ ] Check CI status — all checks green?
- [ ] Note the PR size — is it reviewable?

### Architecture & Design
- [ ] Code is in the correct directories per project structure
- [ ] Existing patterns are reused, not reinvented
- [ ] Separation of concerns is maintained
- [ ] No unnecessary coupling between modules
- [ ] Abstraction level is appropriate (not over/under-engineered)
- [ ] Data flow is clear and follows project conventions
- [ ] No duplicated logic that should be extracted (DRY)

### Correctness
- [ ] No logic errors, off-by-one, or wrong comparisons
- [ ] Edge cases handled (null/undefined, empty arrays, boundary values)
- [ ] Errors handled properly (no swallowed errors, user gets feedback on failure)
- [ ] No race conditions (stale closures, unmounted component updates)
- [ ] Type assertions and casts are correct

### Security
- [ ] New tables have RLS policies
- [ ] User input is validated at boundaries
- [ ] No secrets in code

### Performance
- [ ] Pure components use `React.memo`
- [ ] No inline closures/objects in render for list items
- [ ] Expensive operations are memoized
- [ ] Database queries use pagination where appropriate

### Code Quality
- [ ] No unused imports, variables, or functions
- [ ] No commented-out code blocks
- [ ] No stale TODOs referencing completed work
- [ ] `@/` imports throughout
- [ ] `<Text>` from common, not React Native
- [ ] Design tokens used, no hardcoded values
- [ ] No `console.log` in production code
- [ ] No duplicated logic or copy-pasted blocks

### Testing
- [ ] New critical code has tests (per AGENTS.md table)
- [ ] Auth/security changes have success AND failure tests
- [ ] Tests follow project patterns (factories, `renderWithProviders`)

### i18n
- [ ] No hardcoded user-facing strings
- [ ] Translations present in both `en` and `es`
- [ ] No asymmetric translation keys

### PR Hygiene
- [ ] Conventional commit messages
- [ ] Type label present
- [ ] Description explains the "why"

### Highlights, Recommendations, Potential Misses & Next Steps
- [ ] Acknowledged good patterns in the PR
- [ ] Identified high-value recommendations beyond findings, ranked by impact vs effort
- [ ] Identified areas the review couldn't fully evaluate (runtime behavior, accessibility, integration effects)
- [ ] Documented next steps for follow-up

---

## Related Documentation

- [CLAUDE.md](../../../CLAUDE.md) — Development setup and key conventions
- [AGENTS.md](../../../AGENTS.md) — AI agent guidelines and testing requirements
- [TESTING.md](../../operations/TESTING.md) — Comprehensive testing documentation
- `.claude/skills/review-pr/SKILL.md` — The `yummyyummix:review-pr` skill prompt (for debugging or updating the skill)
- `.claude/skills/review-changes/SKILL.md` — The `yummyyummix:review-changes` skill prompt (pre-PR local commit review)
- `.claude/agents/code-reviewer.md` — The `yummyyummix:code-reviewer` sub-agent prompt

---
