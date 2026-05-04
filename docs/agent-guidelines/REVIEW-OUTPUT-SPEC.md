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

2-4 entries of what's done well. Keep it genuine — skip if nothing stands out.

**Format: bold-label paragraph blocks.** Each highlight is two lines, no list syntax. The first line is a `**Highlight N.**` bold-label intro followed by the plain-language user/product/architectural value (max ~20 words). The second line is `**Where:**` followed by the file pointer and the mechanic. A blank line separates entries.

This format avoids relying on Markdown sub-bullet indentation, which renders inconsistently in terminal outputs.

```
**Highlight 1.** The menu stays correct after every change — swaps, skips, and cooks all refresh automatically.
**Where:** `useMealPlan.ts:88` — every mutation calls `queryClient.invalidateQueries(mealPlanKeys.active())` in `onSuccess`.

**Highlight 2.** Client and server speak the exact same vocabulary, so drift gets caught at compile time.
**Where:** `types/mealPlan.ts` — `as const` arrays + derived union types mirror server `types.ts`.
```

Rules:
- The intro line has no file paths, function names, or API surface — those go on the `**Where:**` line.
- One sentence per line. If you can't explain *why it's good* in plain language, drop the highlight.
- Acknowledge patterns with leverage, not local cleverness.

### 5. Issues at a Glance

A **single table** of all findings — one row per finding, sorted by severity (Critical → Warning → Suggestion). This is the scannable overview: the reader should be able to see every issue, where it lives, and how bad it is in one glance, without reading any prose.

Columns:
- `#` — sequential ID (1, 2, 3…). Reused in Next Steps so detail can be matched back to the table row.
- `Sev` — `Critical`, `Warning`, or `Suggestion`.
- `Area` — one of: Frontend, Backend, Database, AI, Infra, Docs, i18n, Tests. Pick the dominant area for the finding.
- `File` — `path:line` (or just `path` when no specific line).
- `Issue` — a 6–12 word headline. No recommendation, no options, no sub-bullets.

Format:
```
| # | Sev        | Area     | File                          | Issue                                  |
|---|------------|----------|-------------------------------|----------------------------------------|
| 1 | Critical   | Backend  | meal-planner/index.ts:142     | Missing auth check on swap action      |
| 2 | Warning    | Frontend | useMealPlan.ts:88             | Stale cache after skip mutation        |
| 3 | Suggestion | Tests    | mealPlanService.test.ts       | No error-path coverage                 |
```

Only include suggestions you actively recommend. If it's not worth doing, don't list it.

If there are zero findings, omit the table and write *No issues found.*

This table **replaces** the older flat-bulleted Issues section. Do not duplicate the same findings as both a table and a bulleted list in the human section.

### 6. Next Steps

A self-contained prompt for an implementation agent. This is where **all the detail lives** — category grouping, options/tradeoffs for complex findings, recommendations table, potential misses. See [Next Steps Prompt Contract](#next-steps-prompt-contract) below.

If there are no findings to act on, omit this section.

---

## Formatting and Whitespace

How the report is laid out matters as much as what it says. The following rules apply to every review output (PR review, change review, triage, recipe review):

- **Two-line bold-label paragraph blocks** are the canonical format for Highlights, Verdict Notes, and Notes-style prose sections (see *Highlights* in section 4). The first line is the bold-label intro (`**Highlight N.**`, `**#N Verdict.**`, etc.); the second line is `**Where:**` with the file pointer and mechanic. No list syntax, no nested indentation.
- **Blank line between every entry.** Whether a finding is two lines (Highlights, Notes) or one row (Issues at a Glance has no inter-row blank lines because it's a table), entries within a prose section get a blank line between them. Terminals keep the vertical breathing room; markdown viewers render the entries as discrete blocks.
- **`---` horizontal rule between major sections.** One rule per boundary, not decorative repetition. Boundaries are: header block → glance table → notes/highlights → next-steps / handoff prompt. Adjacent text-only sections (e.g. Verdict → Highlights) do not need a rule between them.
- **Tables stay tight.** No blank lines inside the table body. Whitespace lives between sections, not inside them.
- **No trailing decorative whitespace.** No blank lines at the very end of the report; no triple blank lines anywhere.

### Worked example (Highlights / Notes-style section)

Right (bold-label paragraph blocks — entries separated by blank lines, no list syntax):

```
**Highlight 1.** The menu stays correct after every change — swaps, skips, and cooks all refresh automatically.
**Where:** `useMealPlan.ts:88` — every mutation invalidates the active-plan query in `onSuccess`.

**Highlight 2.** Client and server speak the exact same vocabulary, so drift gets caught at compile time.
**Where:** `types/mealPlan.ts` — `as const` arrays + derived union types mirror server `types.ts`.
```

Wrong (no blank line between entries — readers can't see where one ends and the next begins):

```
**Highlight 1.** The menu stays correct after every change — swaps, skips, and cooks all refresh automatically.
**Where:** `useMealPlan.ts:88` — every mutation invalidates the active-plan query in `onSuccess`.
**Highlight 2.** Client and server speak the exact same vocabulary, so drift gets caught at compile time.
**Where:** `types/mealPlan.ts` — `as const` arrays + derived union types mirror server `types.ts`.
```

Wrong (intro and `**Where:**` separated by a blank line — they read as two unrelated paragraphs):

```
**Highlight 1.** The menu stays correct after every change — swaps, skips, and cooks all refresh automatically.

**Where:** `useMealPlan.ts:88` — every mutation invalidates the active-plan query in `onSuccess`.
```

### Section-boundary example

```
### Verdict

**APPROVE** — 0 critical, 2 warnings, 4 suggestions

### Highlights

**Highlight 1.** <plain-language value>
**Where:** `file:line` — <mechanic>

**Highlight 2.** <plain-language value>
**Where:** `file:line` — <mechanic>

---

### Issues at a Glance

| # | Sev | Area | File | Issue |
|---|-----|------|------|-------|
| 1 | Warning | Frontend | `file:line` | <headline> |

---

### Next Steps

> Copy-paste the prompt below to the implementing AI.
…
```

One rule between glance table and next steps; no rule between Verdict and Highlights (both compact text blocks).

---

## Internal Review Process

The reviewer still performs the full analysis internally (all 9 categories, severity assessment, options for critical findings, potential misses). This work feeds into the report — the human section is a distillation, and the Next Steps prompt is a reorganization with full detail. **Don't skip the analysis, just don't dump all of it into the human-facing output.**

For Suggestion-level findings: only include ones you actively recommend. If a suggestion isn't worth doing, omit it entirely. No "implement if worthwhile" hedging — take a clear position.

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
2. List recommended improvements — only suggestions the reviewer actively recommends
3. Note any potential misses or areas the review couldn't fully evaluate
4. Instruct the agent to: read relevant files, create an implementation plan, implement, run tests/validation
5. Be fully self-contained — executable without reading the review

### Template

```text
You are the implementation agent for [PR #N / branch-name].

## Review Findings — Fix All

Finding numbers (#1, #2…) match the "Issues at a Glance" table in the review.

### Critical
- **#1** [Critical] `file:line` — description
  - Recommendation: <specific recommendation>
  - Options:
    1. **A (Recommended)** <option> — Effort: S/M/L, Risk: <...>, Impact: <...>
    2. **B** <option> — Effort: S/M/L, Risk: <...>, Impact: <...>

### High
- **#2** [High] `file:line` — description
  - Recommendation: <specific recommendation>

### Warning
- **#3** [Warning] `file:line` — description
  - Recommendation: <specific recommendation>

## Recommended Improvements

Only include suggestions the reviewer actively recommends. If it's not worth doing, don't list it.

- **#4** `file:line` — description. Do: <specific action>

## Potential Misses

Areas the review couldn't fully evaluate:
- <what was uncertain and why>

## Workflow

1. Read the relevant files to understand context.
2. Create an implementation plan that addresses all findings and recommended improvements.
3. Implement the plan.
4. Run tests and validation for changed areas.
5. Report what was done and flag any issues encountered.

Constraints:
- Keep changes scoped to the review's context.
- Avoid unrelated refactors.
```

Key rules:
- Finding numbers (#N) must match the "Issues at a Glance" table row IDs so the human can cross-reference.
- Critical/High/Warning findings are required fixes — include full detail and options.
- Suggestions are either recommended (include with clear action) or not worth mentioning (omit entirely). No "if worthwhile" hedging.
- The prompt never references the review report — it is the complete instruction set.
- Potential misses live in the Next Steps prompt, not the human-facing section.

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

**Human section:** Header, verdict, highlights, "Issues at a Glance" table.

**Detail section:** Since plan reviews don't have a "Next Steps" prompt (the output IS the feedback), the detailed findings with options/tradeoffs go into a collapsible "Detailed Findings" section after the issues list. Also includes Unverified Assumptions.

### Unverified Assumptions

In plan reviews, replaces "Potential Misses." Reframed as direct questions for the planner to confirm:

```markdown
### Unverified Assumptions

Please verify:
- Does the `recipes` table have a `thermomix_params` JSONB column?
- Does the AI Gateway support streaming with structured output simultaneously?
```
