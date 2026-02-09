# Review Changes Prompt Template

Use this prompt when invoking the skill directly:

```text
Use $yummyyummix:review-changes to review my latest changes.

Scope:
- If no explicit scope is provided, review unpushed commits plus uncommitted changes.
- You may also use:
  - <N> for last N commits
  - <A..B> for an explicit commit range

Evaluate against all 8 review categories in references/REVIEW-CRITERIA.md:
1. Architecture & Design
2. Correctness
3. Security
4. Performance
5. Code Quality
6. Testing
7. i18n
8. Commit Hygiene

Output requirements:
- Constructive feedback with explicit acknowledgment of good patterns.
- Findings with file path, line references, severity (Critical/Warning/Suggestion), and fix recommendation.
- For Critical findings: provide 2-3 options with effort, risk, impact, maintenance burden; put recommended option first.
- Warning findings that materially affect readiness should also include options.
- Suggestions and Improvements section ranked by impact/effort.
- Potential Misses section for uncertainty areas and extra validation.
- Summary counts by severity and readiness recommendation (READY FOR PR / QUICK FIXES THEN PR / NEEDS WORK).
- Next-Step Agent Prompt that tells a follow-up coding agent to:
  1) create an implementation plan first,
  2) implement only worthwhile items aligned with objective,
  3) report deferred items with rationale.
```

## Example Invocations

```text
Use $yummyyummix:review-changes.
```

```text
Use $yummyyummix:review-changes 3.
```

```text
Use $yummyyummix:review-changes main..HEAD.
```
