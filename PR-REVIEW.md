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

## Review Criteria

### Architecture & Design

Two layers of review:

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

### Dead Code & Cleanup

- **Unused imports**: Imported but never referenced in the file
- **Unused variables/functions**: Declared but not used
- **Commented-out code**: Should be deleted, not commented. Git preserves history
- **Stale TODOs**: `TODO`, `FIXME`, `HACK` comments that reference completed or abandoned work
- **Unused exports**: Exported but not imported anywhere in the codebase
- **Partial refactor leftovers**: Old implementation left alongside new one
- **Redundant code**: Logic made unnecessary by the PR's own changes

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

Based on the [AGENT.md](./AGENT.md) requirements table:

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

### Conventions

| Convention | Rule |
|-----------|------|
| **Imports** | Always use `@/` alias. Never relative paths like `../../` |
| **Text component** | Always `<Text>` from `@/components/common`. Never React Native's `Text` |
| **Button component** | `<Button>` from `@/components/common` with `variant` and `size` props |
| **Styling** | NativeWind with design tokens from `constants/design-tokens.js`. No hardcoded colors or pixel values |
| **i18n** | All user-facing strings use `i18n.t()`. Both `en` and `es` translations required |
| **Layouts** | Use `PageLayout` and `ResponsiveLayout` from `@/components/layouts/` |
| **Edge functions** | CORS headers, auth validation from `_shared/`, follow existing patterns |
| **Console logs** | No `console.log` in production code |
| **TypeScript** | No `any` unless explicitly justified |
| **Lists** | `FlashList` for long lists |
| **Images** | `expo-image` for all images |
| **Pure components** | `React.memo` for components that don't need re-renders |

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
| Dead code | No | Yes |
| Performance | No | Yes |
| Security (RLS, secrets) | No | Yes |
| Test coverage gaps | No | Yes |
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

### Dead Code & Cleanup
- [ ] No unused imports, variables, or functions
- [ ] No commented-out code blocks
- [ ] No stale TODOs referencing completed work

### Performance
- [ ] Pure components use `React.memo`
- [ ] No inline closures/objects in render for list items
- [ ] Expensive operations are memoized
- [ ] Database queries use pagination where appropriate

### Security
- [ ] New tables have RLS policies
- [ ] User input is validated at boundaries
- [ ] No secrets in code

### Testing
- [ ] New critical code has tests (per AGENT.md table)
- [ ] Auth/security changes have success AND failure tests
- [ ] Tests follow project patterns (factories, `renderWithProviders`)

### Conventions
- [ ] `@/` imports throughout
- [ ] `<Text>` from common, not React Native
- [ ] Design tokens used, no hardcoded values
- [ ] i18n for all user-facing strings (both `en` and `es`)
- [ ] No `console.log` in production code

### PR Hygiene
- [ ] Conventional commit messages
- [ ] Type label present
- [ ] Description explains the "why"

---

## Related Documentation

- [CLAUDE.md](./CLAUDE.md) — Development setup and key conventions
- [AGENT.md](./AGENT.md) — AI agent guidelines and testing requirements
- [TESTING.md](./TESTING.md) — Comprehensive testing documentation
- `.claude/skills/review-pr/SKILL.md` — The `yummyyummix:review-pr` skill prompt (for debugging or updating the skill)
- `.claude/agents/code-reviewer.md` — The `yummyyummix:code-reviewer` sub-agent prompt

---
