# Review Output Specification

Shared output contract for all YummyYummix review skills (Claude and Codex). If a platform skill diverges from this document, this document is authoritative for section definitions, purposes, and the Next Steps prompt contract.

For review categories, severity levels, and recommendation logic, see [REVIEW-CRITERIA.md](./REVIEW-CRITERIA.md).

---

## Report Sections

Every review report must include these sections in order. Section names are canonical.

### 1. CI Status (PR reviews only)

Pass/fail table for CI checks. Omit for pre-PR reviews.

### 2. Highlights

Acknowledge good patterns, clean implementations, or smart design choices. Balanced reviews encourage good practices and provide useful context for the author.

### 3. Findings

Issues grouped by the 9 review categories (Architecture & Design, Correctness, Security, Performance, Code Quality, Testing, i18n, Hygiene, Documentation). Each finding tagged with a severity level.

Use *No issues found.* for clean categories.

### 4. Summary

Severity counts (Critical, Warning, Suggestion) and overall recommendation:
- PR context: APPROVE / COMMENT / REQUEST CHANGES
- Pre-PR context: READY FOR PR / QUICK FIXES THEN PR / NEEDS WORK

### 5. Recommendations

High-value improvements **related to the changes but outside what was flagged in Findings**. These are opportunities the author may have missed, not a restatement of issues already found.

Think about:
- Adjacent code that could benefit from similar treatment
- Patterns elsewhere in the codebase worth adopting
- Opportunities this change opens up
- Missing tests for related (not just changed) code
- Documentation that would help future developers

**Do NOT repeat issues already listed in Findings.** Rank by impact vs effort.

Format as a table:

| Rank | Recommendation | Impact | Effort | Rationale |
|------|----------------|--------|--------|-----------|
| 1 | ... | High | Low | ... |

### 6. Potential Misses

Areas the review couldn't fully evaluate. Be explicit about what is uncertain and why.

Think about: files that couldn't be read, runtime behavior not verifiable from a diff, integration concerns, UX flows, accessibility, areas where the diff was too large to review thoroughly, transitive dependencies.

### 7. Next Steps

A self-contained prompt for an implementation agent. See [Next Steps Prompt Contract](#next-steps-prompt-contract) below.

---

## Finding Format

Every finding must include:
- Severity tag: `[Critical]`, `[Warning]`, or `[Suggestion]`
- File path and line number (when possible)
- Concrete description of the issue
- Specific recommendation/fix

### Critical Findings

Must include 2-3 options with tradeoffs:

```
- [Critical] `path/to/file.ts:42` - <description>
  - Recommendation: <specific recommendation>
  - Options:
    1. **A (Recommended)** <option> - Effort: S/M/L, Risk: <...>, Impact: <...>, Maintenance: <...>
    2. **B** <option> - Effort: S/M/L, Risk: <...>, Impact: <...>, Maintenance: <...>
    3. **C** <option> - Effort: S/M/L, Risk: <...>, Impact: <...>, Maintenance: <...>
```

Put the recommended option first and explain why.

### Warning Findings That Affect Merge/Readiness Risk

Also include options/tradeoffs (same format as Critical).

### Suggestion Findings

Concise recommendation, no option matrix needed.

---

## Next Steps Prompt Contract

The Next Steps section must produce a **self-contained prompt** that an implementation agent can execute without reading the review report. The prompt must:

1. List **Critical and Warning** findings from the review with severity, file:line, and description under "Fix All"
2. List **Suggestion** findings under "Implement If Worthwhile"
3. List Recommendations worth implementing under "Implement If Worthwhile"
4. Instruct the agent to: read relevant files, create an implementation plan addressing required findings plus selected suggestions/recommendations, implement the plan, run tests/validation
5. Be fully self-contained — executable without reading the review

### Template

```text
You are the implementation agent for [PR #N / branch-name].

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
- Keep changes scoped to the review's context.
- Avoid unrelated refactors.
```

Key rules:
- Critical/Warning findings are required fixes.
- Suggestions and Recommendations are listed separately and marked "implement if worthwhile" — the agent uses judgment here.
- The prompt never references the review report — it is the complete instruction set.
