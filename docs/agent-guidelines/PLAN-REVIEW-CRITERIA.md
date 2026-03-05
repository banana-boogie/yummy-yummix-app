# Plan Review Criteria

Canonical definitions for all YummyYummix plan review tools. If any consumer file diverges from this document, this document is authoritative.

---

## Review Preferences

These preferences calibrate reviewer behavior across all categories:

- **Verify file paths and code references** against the actual codebase — flag any that don't exist or have moved
- **Flag vague specs** that force the implementer to make undocumented decisions — plans should be executable without guessing
- **Check architecture alignment** — plans must respect existing patterns, infrastructure, and conventions in CLAUDE.md
- **Validate sequencing** — build order must be dependency-correct with no hidden blockers
- **Ensure security, i18n, and testing are addressed** — not deferred indefinitely or omitted without justification
- **Bias toward specificity** — "add error handling" is too vague; "add try/catch around the Supabase call in generateRecipe() with user-facing error toast" is actionable

---

## Review Categories

### 1. Problem & Goal Clarity

Is the problem well-defined? Could an implementer know what "done" looks like?

- Problem statement is clear and specific
- Success criteria are defined and measurable
- Non-goals are stated (what this plan intentionally does NOT do)
- Target audience/user impact is identified
- Motivation explains why this work matters now

### 2. Completeness & Specificity

Are all affected domains covered? Is each step specific enough to execute?

- All affected areas identified (frontend, backend, database, AI, infrastructure)
- Error states and edge cases addressed (loading, empty, error, success)
- Each implementation step is specific enough to execute without guessing
- Data flow is traced end-to-end (where data originates, transforms, and is consumed)
- No implicit assumptions — dependencies and prerequisites are stated
- UI states fully specified (not just the happy path)

### 3. Architecture Fit

Does the plan align with existing patterns and infrastructure?

- Correct directory placement per CLAUDE.md architecture section
- Uses existing infrastructure rather than reimplementing:
  - AI Gateway (not direct provider calls)
  - Common components (Text, Button from `@/components/common`)
  - Design tokens (not hardcoded values)
  - PageLayout/ResponsiveLayout
  - Existing services and hooks
- Component/service boundaries follow established patterns
- Data access through services layer (not direct Supabase calls from components)
- Platform-specific code uses Metro's `.web.ts` pattern where appropriate

### 4. Feasibility & Accuracy

Are the plan's assumptions about the codebase correct?

- Referenced files and directories actually exist
- Assumptions about current code behavior are accurate
- API and schema assumptions match reality
- Dependencies (packages, services, APIs) are available and compatible
- Estimated complexity aligns with what the codebase actually requires
- No reliance on features or APIs that don't exist yet (unless the plan creates them)

### 5. Scope & Sequencing

Is the build order correct? Are boundaries clear?

- Dependency-correct build order (database before backend before frontend)
- Hidden blockers identified (migrations that must deploy before code changes, etc.)
- Clear in-scope and out-of-scope boundaries
- Each phase or step has a clear deliverable
- No circular dependencies between implementation steps
- Scope is appropriately sized — not trying to do too much in one plan

### 6. Risk & Gaps

Are risks identified with mitigations?

- Known risks listed with mitigation strategies
- Rollback strategies for irreversible changes (especially database migrations)
- External dependencies acknowledged (third-party APIs, services, packages)
- Data migration concerns addressed (existing data compatibility)
- Performance impact considered for changes touching hot paths
- Security implications identified for auth, data access, or API changes

### 7. Verification Strategy

How will we know the implementation is correct?

- Acceptance criteria are defined and testable
- Concrete test plan (what to test, how to test it)
- Exit criteria for each phase (when is a phase "done"?)
- Manual verification steps where automated testing isn't sufficient
- Integration testing approach for cross-domain changes

### 8. Conventions & Standards

Does the plan follow project-specific patterns?

- Migration workflow: backup -> `migration:new` -> `db:push` (never MCP `apply_migration`)
- i18n: translations in both `en` and `es`, using `i18n.t()` for user-facing strings
- RLS policies on every new database table
- AI interactions through AI Gateway (not direct OpenAI/Anthropic calls)
- Design tokens from `constants/design-tokens.js` (not hardcoded colors/spacing)
- Imports use `@/` alias
- Text/Button from `@/components/common`
- Edge functions follow `_shared/` patterns (CORS, auth validation)
- Tests required for critical code (per TESTING.md requirements table)

---

## Severity Levels

Tag each finding with one of:

- **Critical** — Plan will lead to broken, insecure, or data-losing implementation. Must rethink before implementing.
- **High** — Significant gaps that will cause major rework during implementation. Should fix in the plan before proceeding.
- **Warning** — Should improve but implementable as-is. May cause minor rework or tech debt.
- **Suggestion** — Nice improvement, not blocking. Plan is implementable without this change.

---

## Recommendation Logic

| Findings | Recommendation |
|----------|---------------|
| Any **Critical** | RETHINK |
| Any **High** or 3+ **Warning** | RETHINK |
| 1-2 **Warning** | REFINE THEN PROCEED |
| Only **Suggestion** or clean | PROCEED |

---

## Report Sections

Every plan review report should include these standardized sections. For plan-specific output formatting, finding references, and the feedback framing contract, see the "Plan Review Variant" section in [REVIEW-OUTPUT-SPEC.md](./REVIEW-OUTPUT-SPEC.md).

1. **Highlights** — Strong aspects of the plan. Balanced reviews are constructive.
2. **Findings** — Grouped by the 8 review categories above, each tagged with a severity level.
3. **Summary** — Severity counts and overall recommendation: PROCEED / REFINE THEN PROCEED / RETHINK.
4. **Recommendations** — High-value improvements related to the plan but outside what was flagged in Findings. Do NOT repeat Findings. Ranked by impact vs effort.
5. **Unverified Assumptions** — Assumptions in the plan that couldn't be confirmed against the codebase, reframed as questions for the planner to verify.
