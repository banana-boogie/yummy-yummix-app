# Review Criteria

Canonical definitions for all YummyYummix code review tools. If any consumer file diverges from this document, this document is authoritative.

---

## Engineering Preferences

These preferences calibrate reviewer behavior across all categories:

- **Flag DRY violations aggressively** — even 2-3 repeated lines of similar logic warrant a finding
- **Flag both over- and under-engineering** — premature abstractions are as bad as duplicated logic
- **Bias toward more edge case handling** — missing error handling and unhandled states should be flagged
- **Prefer explicit over clever** — complex one-liners, obscure patterns, and implicit behavior are worth flagging
- **Missing tests for critical code = Warning or Critical**, not Suggestion

---

## Review Categories

### 1. Architecture & Design

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

### 2. Correctness

- **Bugs**: Logic errors, off-by-one, wrong comparisons, incorrect assumptions about data shape or API behavior
- **Edge cases**: Missing null/undefined checks, empty array handling, boundary values, missing default cases in switch/if chains
- **Error handling**: Unhandled promise rejections, missing try/catch around fallible operations, swallowed errors (catch blocks that silently ignore), missing user feedback on failure
- **Race conditions**: Stale closures capturing old state, state updates on unmounted components, concurrent data mutations without guards
- **Type safety**: Incorrect type assertions (`as`), unsafe casts, types that don't match runtime values, overly permissive generics

### 3. Security

- **RLS policies**: Every new database table MUST have Row Level Security policies (Critical if missing)
- **Input validation**: Validate user input at system boundaries (forms, API endpoints, edge functions)
- **Exposed secrets**: No API keys, tokens, or credentials in code or committed config files
- **SQL injection**: Parameterized queries only, no string interpolation in SQL
- **XSS**: Sanitize any user-generated content before rendering

### 4. Performance

- **Missing `React.memo`**: Pure components that receive complex props and render frequently
- **Inline closures in render**: `onPress={() => handler(id)}` inside list items causes re-renders. Extract to stable references
- **Inline objects in render**: `style={{ padding: 10 }}` creates new object each render
- **Missing memoization**: `useMemo` for expensive computations, `useCallback` for stable function references passed as props
- **N+1 queries**: Fetching related data in a loop instead of using joins or batch queries
- **Missing pagination**: `.select('*')` without `.range()` or `.limit()` on potentially large tables
- **FlatList vs FlashList**: `FlatList` should be `FlashList` for large or dynamic lists
- **Image optimization**: Raw `<Image>` should be `expo-image` for caching and progressive loading
- **Bundle size**: Large library imports that could be tree-shaken or lazy-loaded

### 5. Code Quality

**Dead code**
- Unused imports, variables, functions, exports
- Commented-out code (should be deleted — Git preserves history)
- Stale `TODO`/`FIXME`/`HACK` comments referencing completed or abandoned work
- Partial refactor leftovers (old implementation left alongside new one)
- Code made redundant by the PR's or commit's own changes

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

### 6. Testing

**Requirements table** (from [AGENT.md](../../AGENT.md)):

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

### 7. i18n

- Hardcoded user-facing strings that should use `i18n.t()`
- Missing translations in either `en` or `es`
- Translation keys added to one language but not the other

### 8. Hygiene

Consumers choose the appropriate label — "PR Hygiene" for PR reviews, "Commit Hygiene" for pre-PR reviews.

- **Conventional commits**: Messages follow `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:` format with optional scope
- **Scope focus**: Each commit/PR is focused on a single concern (not mixing unrelated changes)
- **PR-specific** (when reviewing a PR):
  - PR has a type label (`feature`, `fix`, `chore`, `docs`, `refactor`, `test`)
  - PR is a reasonable size (warn if >50 files or >1000 lines added)
  - PR description explains the "why"

### 9. Documentation

- **Stale docs**: Changes introduce or modify patterns documented in `CLAUDE.md`, `docs/agent-guidelines/`, or `docs/architecture/` but the docs weren't updated to match
- **Missing entries**: New edge functions, components, services, or hooks not reflected in directory maps or guideline docs
- **Broken references**: File paths in docs that no longer exist due to renames, moves, or deletions
- **Convention drift**: Code establishes a new pattern that contradicts what docs describe as the convention

Severity: **Suggestion** for minor gaps (e.g., a new hook not listed in a directory map). **Warning** for misleading docs (e.g., docs describe a pattern the code no longer follows).

---

## Severity Levels

Tag each finding with one of:

- **Critical** — Must fix. Bugs, security vulnerabilities (missing RLS, exposed secrets, injection), broken CI, missing tests for auth/security code, data loss risk.
- **Warning** — Should fix. Performance issues (missing memoization, N+1 queries), missing tests for new features, convention violations that affect maintainability, missing error handling for likely edge cases, dead code that adds confusion.
- **Suggestion** — Nice to have. Minor style preferences beyond what linters catch, optional performance optimizations, documentation improvements, code organization preferences.

---

## Recommendation Logic

Thresholds are the same regardless of context; labels adapt to the review type.

| Findings | PR Context | Pre-PR Context |
|----------|-----------|----------------|
| Any **Critical** | REQUEST CHANGES | NEEDS WORK |
| 3+ **Warning** | REQUEST CHANGES | NEEDS WORK |
| 1-2 **Warning** | COMMENT | QUICK FIXES THEN PR |
| Only **Suggestion** or clean | APPROVE | READY FOR PR |

---

## Report Sections

Every review report should include these standardized sections (names are canonical). For full section definitions, finding format, and the Next Steps prompt contract, see [REVIEW-OUTPUT-SPEC.md](./REVIEW-OUTPUT-SPEC.md).

1. **Highlights** — Good patterns, clean implementations, smart design choices. Balanced reviews are constructive.
2. **Findings** — Grouped by the 9 review categories above, each tagged with a severity level.
3. **Summary** — Severity counts and overall recommendation (APPROVE/REQUEST CHANGES or READY/NEEDS WORK).
4. **Recommendations** — High-value improvements related to the changes but outside what was flagged in Findings. Do NOT repeat Findings. Ranked by impact vs effort.
5. **Potential Misses** — Areas the review couldn't fully evaluate (runtime behavior, accessibility, integration effects, large diffs).
6. **Next Steps** — Self-contained prompt where Critical/Warning findings are required fixes and Suggestions/Recommendations are "implement if worthwhile", without requiring the implementation agent to read the full review.
