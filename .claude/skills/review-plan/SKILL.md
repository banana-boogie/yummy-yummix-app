---
name: review-plan
description: Review implementation plans for clarity, completeness, architecture fit, and feasibility before implementation. Use when asked to evaluate a plan file, pasted plan content, or review recent plans.
---

# Plan Review Skill

Review an implementation plan against YummyYummix project standards.

## Instructions

You are reviewing an implementation plan for the YummyYummix codebase. Follow these steps exactly.

### Step 1: Resolve Plan Input

Resolve `$ARGUMENTS` in this order:

1. **No argument** — Scan `docs/plans/*.md` and `.claude/plans/*.md`, present candidates sorted by recency, ask user to confirm. If none found, ask for file path or pasted content.
2. **File path** (starts with `/`, `./`, `docs/`, `.claude/`, or ends with `.md`) — Read the file.
3. **Anything else** — Treat as inline plan content pasted directly after the command.

### Step 2: Read Plan and Gather Context

1. Read the plan content (from file or inline)
2. Extract all file paths referenced in the plan
3. Verify referenced files exist using Glob — note any that are missing or have moved
4. Read project standards:
   - `docs/agent-guidelines/PLAN-REVIEW-CRITERIA.md` (canonical plan review criteria, categories, severity, and recommendation logic)
   - `docs/agent-guidelines/REVIEW-OUTPUT-SPEC.md` (output format — two-tier: human summary + detailed findings)
   - `CLAUDE.md` (architecture and key conventions)
5. Read key codebase files the plan references to verify accuracy of assumptions — focus on files the plan modifies or depends on

### Step 3: Full Internal Review

Evaluate the plan against all 8 categories defined in `docs/agent-guidelines/PLAN-REVIEW-CRITERIA.md`:

1. Problem & Goal Clarity
2. Completeness & Specificity
3. Architecture Fit
4. Feasibility & Accuracy
5. Scope & Sequencing
6. Risk & Gaps
7. Verification Strategy
8. Conventions & Standards

Apply the **Review Preferences** from that document throughout. Use the **Severity Levels** (Critical / High / Warning / Suggestion) and **Recommendation Logic** defined there.

For every finding, capture internally:
- Severity tag, section reference, concrete description, specific recommendation.
- Critical and High findings: 2-3 options with effort/risk/impact tradeoffs.
- Warning findings that affect recommendation: also include options/tradeoffs.

Also prepare:
- **Highlights** — Strong aspects of the plan.
- **Recommendations** — High-value improvements outside Findings. Do NOT repeat findings.
- **Unverified Assumptions** — Assumptions that couldn't be confirmed. Reframe as questions.

### Step 4: Output the Report

The output is designed to be copy-pasted into the planning agent's chat as direct feedback. It has **two tiers**: a short human-readable summary, then detailed findings for the planning AI.

**Keep the human section short and scannable.**

````markdown
## Plan Review Feedback: <plan-file-name or "Inline Plan">

> This is feedback from a cross-AI plan review. Address all Critical, High, and Warning findings before implementing. Suggestions and Recommendations are optional improvements.

**Plan:** <brief description from plan title or first section>
**File:** <path or "inline">
**Domains:** <areas the plan touches>

### Verdict

**<PROCEED / REFINE THEN PROCEED / RETHINK>** — <critical count> critical, <high count> high, <warning count> warnings, <suggestion count> suggestions

### Highlights

- <strong aspect of the plan>

### Issues

**Must fix**
- [Critical] Section X — one-sentence description
- [High] Section X — one-sentence description
- [Warning] Section X — one-sentence description

**Recommended**
- [Suggestion] Section X — one-sentence description

### Unverified Assumptions

Please verify:
- <assumption reframed as a question>

---

### Detailed Findings

> For the planning AI — full context for each finding.

#### Problem & Goal Clarity
- [severity] Section X — description
  - Recommendation: <specific recommendation>
  - Options: (Critical/High only)
    1. **A (Recommended)** <option> — Effort: S/M/L, Risk: <...>, Impact: <...>
    2. **B** <option> — Effort: S/M/L, Risk: <...>, Impact: <...>

#### Completeness & Specificity
...

#### Architecture Fit
...

#### Feasibility & Accuracy
...

#### Scope & Sequencing
...

#### Risk & Gaps
...

#### Verification Strategy
...

#### Conventions & Standards
...

(Use *No issues found.* if a category is clean.)

### Recommendations

| Rank | Recommendation | Impact | Effort | Rationale |
|------|----------------|--------|--------|-----------|
| 1 | <high-value improvement outside Findings> | High | Low | <reason> |

Do NOT repeat issues already listed above.
````
