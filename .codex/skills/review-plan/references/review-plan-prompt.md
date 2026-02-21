# Review Plan Prompt Template

Use this prompt when invoking the skill directly:

```text
Use $yummyyummix:review-plan to review the plan at <FILE_PATH_OR_PASTE_CONTENT>.
If no plan argument is provided, scan docs/plans/ for recent plans and ask me to confirm before reviewing.

Evaluate against all 8 plan review categories in docs/agent-guidelines/PLAN-REVIEW-CRITERIA.md:
1. Problem & Goal Clarity
2. Completeness & Specificity
3. Architecture Fit
4. Feasibility & Accuracy
5. Scope & Sequencing
6. Risk & Gaps
7. Verification Strategy
8. Conventions & Standards

Verification behavior:
- Check all file paths referenced in the plan against the actual codebase.
- Read key files the plan depends on to verify assumptions.
- Flag vague specs that force the implementer to guess.

Output requirements:
- Highlights section (strong aspects of the plan)
- Findings grouped by all 8 categories:
  - Problem & Goal Clarity
  - Completeness & Specificity
  - Architecture Fit
  - Feasibility & Accuracy
  - Scope & Sequencing
  - Risk & Gaps
  - Verification Strategy
  - Conventions & Standards
- Each finding tagged as Critical, High, Warning, or Suggestion
- Section references instead of file:line (e.g., "Section 3.2", "Implementation Step 4")
- Every finding includes a concrete recommendation
- For Critical and High findings:
  - include 2-3 options with effort/risk/impact tradeoffs
  - put recommended option first
- Summary with severity counts and recommendation (PROCEED / REFINE THEN PROCEED / RETHINK)
- Recommendations section: high-value improvements outside Findings, ranked by impact vs effort. Do NOT repeat Findings.
- Unverified Assumptions section: assumptions that couldn't be confirmed, reframed as questions for the planner
```

## Example Invocations

```text
Use $yummyyummix:review-plan docs/plans/irmixy-completion-plan.md.
Verify all file references and check architecture fit against CLAUDE.md patterns.
```

```text
Use $yummyyummix:review-plan.
```

```text
Use $yummyyummix:review-plan to review the following plan:

# My Plan
## Problem
...
## Implementation
...
```
