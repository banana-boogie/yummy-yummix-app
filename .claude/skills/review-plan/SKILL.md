---
name: yummyyummix:review-plan
description: Review implementation plans for clarity, completeness, architecture fit, and feasibility before implementation. Use when asked to evaluate a plan file, pasted plan content, or review recent plans.
disable-model-invocation: true
---

# Plan Review Skill

Review an implementation plan against YummyYummix project standards.

## Instructions

You are reviewing an implementation plan for the YummyYummix codebase. Follow these steps exactly.

### Step 1: Resolve Plan Input

`$ARGUMENTS` can be one of three things:

| Input | Detection | Behavior |
|-------|-----------|----------|
| **File path** | Starts with `/`, `./`, `docs/`, `.claude/`, or ends with `.md` | Read the file |
| **Inline plan content** | Contains markdown structure (headers, lists, >100 chars) | Use the pasted content directly as the plan |
| **Empty** | No argument | Scan `docs/plans/*.md` and `.claude/plans/*.md`, present candidates sorted by recency, ask user to confirm. If none found, ask for file path or pasted content. |

For empty arguments, list discovered plans and ask:

> I found the following plans:
> 1. `docs/plans/plan-name.md` (modified: <date>)
> 2. `docs/plans/other-plan.md` (modified: <date>)
>
> Which plan should I review? Or paste plan content directly.

Proceed only after the user confirms.

### Step 2: Read Plan and Gather Context

1. Read the plan content (from file or inline)
2. Extract all file paths referenced in the plan
3. Verify referenced files exist using Glob — note any that are missing or have moved
4. Read project standards:
   - `docs/agent-guidelines/PLAN-REVIEW-CRITERIA.md` (canonical plan review criteria, categories, severity, and recommendation logic)
   - `docs/agent-guidelines/REVIEW-OUTPUT-SPEC.md` (output sections, finding format, and plan review variant)
   - `CLAUDE.md` (architecture and key conventions)
5. Read key codebase files the plan references to verify accuracy of assumptions — focus on files the plan modifies or depends on

### Step 3: Review Against 8 Categories

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

**Finding format** — Follow the plan review variant defined in `docs/agent-guidelines/REVIEW-OUTPUT-SPEC.md`:
- Every finding: severity tag, section reference (plan section name or number), concrete description, specific recommendation.
- Critical and High findings: include 2-3 options with effort/risk/impact tradeoffs. Recommended option first.
- Warning findings that affect recommendation: also include options/tradeoffs.
- Suggestion findings: concise, no option matrix needed.

### Step 4: Prepare Additional Sections

After completing the category evaluation, prepare material for these additional report sections:

**Highlights** — Strong aspects of the plan. Good reviews are balanced — calling out what's well thought through provides useful context and encourages good planning practices. Examples: clear problem framing, thorough edge case coverage, correct build sequencing, good risk identification.

**Recommendations** — High-value improvements **related to the plan but outside what was flagged in Findings**. These are opportunities the planner may have missed, not a restatement of issues already found. Think about: adjacent concerns worth addressing, patterns in the codebase the plan could leverage, scope adjustments that would improve the plan. **Do NOT repeat issues already listed in Findings.** Rank by impact vs effort. Format as a table with Rank, Recommendation, Impact, Effort, and Rationale columns.

**Unverified Assumptions** — Assumptions in the plan that couldn't be confirmed against the codebase. Reframe as direct questions for the planner to verify. Examples: "Does the `recipes` table have a `thermomix_params` column?", "Does the AI Gateway support streaming with structured output simultaneously?"

### Step 5: Output the Report

The entire output is designed to be copy-pasted by the user into the planning agent's chat as direct feedback. The framing header tells the receiving agent what to do.

````markdown
## Plan Review Feedback: <plan-file-name or "Inline Plan">

> This is feedback from a cross-AI plan review. Address all Critical, High, and Warning findings before implementing. Suggestions and Recommendations are optional improvements.

**Plan:** <brief description from plan title or first section>
**File:** <path or "inline">
**Domains:** <frontend/backend/AI/database/infrastructure areas the plan touches>

---

### Highlights

- <strong aspect of the plan>

---

### Findings

#### Problem & Goal Clarity
- [severity] Section X — description
  - Recommendation: <specific recommendation>

#### Completeness & Specificity
- [severity] Section X — description
  - Recommendation: <specific recommendation>

#### Architecture Fit
- [severity] Section X — description
  - Recommendation: <specific recommendation>

#### Feasibility & Accuracy
- [severity] Section X — description
  - Recommendation: <specific recommendation>

#### Scope & Sequencing
- [severity] Section X — description
  - Recommendation: <specific recommendation>

#### Risk & Gaps
- [severity] Section X — description
  - Recommendation: <specific recommendation>

#### Verification Strategy
- [severity] Section X — description
  - Recommendation: <specific recommendation>

#### Conventions & Standards
- [severity] Section X — description
  - Recommendation: <specific recommendation>

(Use *No issues found.* if a category is clean.)

---

### Summary

**Critical:** <count> — Plan will lead to breakage
**High:** <count> — Will cause major rework
**Warning:** <count> — Should improve
**Suggestion:** <count> — Nice to have

**Recommendation:** <PROCEED / REFINE THEN PROCEED / RETHINK>

---

### Recommendations

| Rank | Recommendation | Impact | Effort | Rationale |
|------|----------------|--------|--------|-----------|
| 1 | <high-value improvement outside Findings> | High | Low | <reason> |

Do NOT repeat issues already listed in Findings. These are opportunities related to the plan that the planner may have missed.

---

### Unverified Assumptions

Assumptions in the plan that couldn't be confirmed against the codebase. Please verify:
- <assumption and what to check>
````
