# Review Output Specification

Shared output contract for all YummyYummix review skills (Claude and Codex). If a platform skill diverges from this document, this document is authoritative for section definitions, purposes, and the Next Steps prompt contract.

For review categories, severity levels, and recommendation logic, see [REVIEW-CRITERIA.md](./REVIEW-CRITERIA.md).

---

## Output Philosophy

The report has **two audiences** with different needs:

1. **The human** (the user reading the review) — Wants a quick, scannable verdict: what's good, what's wrong, how bad is it. No option matrices, no category-by-category breakdown. Lead with the answer.
2. **The AI** (the implementing agent) — Needs full detail: exact file:line references, category grouping, options/tradeoffs for complex findings, recommendations. This goes in the Next Steps prompt.

**Rule: Keep the human section short. Put the detail in the AI section.**

---

## Report Sections

Every review report must include these sections in order.

### 1. Header

Brief metadata: PR number/branch, author, file count, additions/deletions, areas touched. Two lines max.

### 2. CI Status (PR reviews only)

Pass/fail table for CI checks. Omit for pre-PR reviews.

### 3. Verdict

One line. The recommendation (APPROVE / COMMENT / REQUEST CHANGES for PRs; READY FOR PR / QUICK FIXES THEN PR / NEEDS WORK for pre-PR) with severity counts inline.

Example: **QUICK FIXES THEN PR** — 0 critical, 2 warnings, 4 suggestions

### 4. Highlights

2-4 bullet points of what's done well. Keep it genuine — skip if nothing stands out.

### 5. Issues

A **flat list** of findings grouped by severity (not by category). Each finding is one line: severity tag, file reference, and a short description. No options, no recommendations, no sub-bullets.

Format:
```
**Must fix**
- [Critical] `file:line` — description (one sentence)

**Should fix**
- [Warning] `file:line` — description (one sentence)

**Nice to have**
- [Suggestion] `file:line` — description (one sentence)
```

If there are zero findings in a severity group, omit that group. If there are zero findings total, write *No issues found.*

### 6. Next Steps

A self-contained prompt for an implementation agent. This is where **all the detail lives** — category grouping, options/tradeoffs for complex findings, recommendations table, potential misses. See [Next Steps Prompt Contract](#next-steps-prompt-contract) below.

If there are no findings to act on, omit this section.

---

## Internal Review Process

The reviewer still performs the full analysis internally (all 9 categories, severity assessment, options for critical findings, recommendations, potential misses). This work feeds into the report — the human section is a distillation, and the Next Steps prompt is a reorganization with full detail. **Don't skip the analysis, just don't dump all of it into the human-facing output.**

---

## Finding Format (Internal)

During review, every finding should have:
- Severity tag: `[Critical]`, `[High]`, `[Warning]`, or `[Suggestion]`
- File path and line number (when possible)
- Concrete description of the issue
- Specific recommendation/fix
- For Critical/High: 2-3 options with effort/risk/impact tradeoffs

This detail goes into the Next Steps prompt, not the human summary.

---

## Next Steps Prompt Contract

The Next Steps section must produce a **self-contained prompt** that an implementation agent can execute without reading the review report. The prompt must:

1. List **Critical, High, and Warning** findings with full detail (severity, file:line, description, recommendation, options where applicable) under "Fix All"
2. List **Suggestion** findings under "Implement If Worthwhile"
3. List Recommendations (improvements outside findings) under "Implement If Worthwhile"
4. Note any potential misses or areas the review couldn't fully evaluate
5. Instruct the agent to: read relevant files, create an implementation plan, implement, run tests/validation
6. Be fully self-contained — executable without reading the review

### Template

```text
You are the implementation agent for [PR #N / branch-name].

## Review Findings — Fix All

### Critical
- [Critical] `file:line` — description
  - Recommendation: <specific recommendation>
  - Options:
    1. **A (Recommended)** <option> — Effort: S/M/L, Risk: <...>, Impact: <...>
    2. **B** <option> — Effort: S/M/L, Risk: <...>, Impact: <...>

### High
- [High] `file:line` — description
  - Recommendation: <specific recommendation>

### Warning
- [Warning] `file:line` — description
  - Recommendation: <specific recommendation>

## Suggestions — Implement If Worthwhile

- [Suggestion] `file:line` — description. Recommendation: <what to do>

## Recommendations — Implement If Worthwhile

| Rank | Recommendation | Impact | Effort |
|------|----------------|--------|--------|
| 1 | ... | High | Low |

## Potential Misses

Areas the review couldn't fully evaluate:
- <what was uncertain and why>

## Workflow

1. Read the relevant files to understand context.
2. Create an implementation plan that addresses all Critical/High/Warning findings plus any Suggestions/Recommendations worth implementing.
3. Implement the plan.
4. Run tests and validation for changed areas.
5. Report what was done and flag any issues encountered.

Constraints:
- Keep changes scoped to the review's context.
- Avoid unrelated refactors.
```

Key rules:
- Critical/High/Warning findings are required fixes — include full detail and options.
- Suggestions and Recommendations are listed separately and marked "implement if worthwhile."
- The prompt never references the review report — it is the complete instruction set.
- Potential misses and recommendations that were previously separate human-facing sections now live here.

---

## Plan Review Variant

Plan reviews use the same output philosophy but with adaptations for reviewing design documents instead of code.

For review categories, severity levels, and recommendation logic specific to plans, see [PLAN-REVIEW-CRITERIA.md](./PLAN-REVIEW-CRITERIA.md).

### Differences from Code Review Output

| Aspect | Code Review | Plan Review |
|--------|------------|-------------|
| **Finding references** | `file:line` | Section names/numbers (e.g., "Section 3.2", "Implementation Step 4") |
| **CI Status section** | Included (PR) or omitted (pre-PR) | Always omitted |
| **Recommendation labels** | APPROVE / COMMENT / REQUEST CHANGES (PR) or READY FOR PR / QUICK FIXES THEN PR / NEEDS WORK (pre-PR) | PROCEED / REFINE THEN PROCEED / RETHINK |
| **Next Steps** | Self-contained implementation prompt | Omitted — the entire output IS the feedback |

### Plan Review Output

Plan reviews follow the same two-tier philosophy:

**Human section:** Header, verdict, highlights, flat issues list by severity.

**Detail section:** Since plan reviews don't have a "Next Steps" prompt (the output IS the feedback), the detailed findings with options/tradeoffs go into a collapsible "Detailed Findings" section after the issues list. Also includes Unverified Assumptions.

### Unverified Assumptions

In plan reviews, replaces "Potential Misses." Reframed as direct questions for the planner to confirm:

```markdown
### Unverified Assumptions

Please verify:
- Does the `recipes` table have a `thermomix_params` JSONB column?
- Does the AI Gateway support streaming with structured output simultaneously?
```
