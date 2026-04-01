# Review Plan Prompt Template

Use this prompt when invoking the skill directly:

```text
Use $yummyyummix:review-plan to review the plan at <FILE_PATH_OR_PASTE_CONTENT>.
If no plan argument is provided, scan docs/plans/ for recent plans and ask me to confirm before reviewing.

Output requirements:
- Human-readable summary: Verdict (PROCEED/REFINE THEN PROCEED/RETHINK with severity counts), Highlights, flat Issues list by severity, Unverified Assumptions
- Detailed Findings section for the planning AI: full findings with categories, options/tradeoffs, recommendations
- Keep the human section short — detail goes in Detailed Findings
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
