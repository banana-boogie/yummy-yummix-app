# Review Changes Prompt Template

Use this prompt when invoking the skill directly:

```text
Use $yummyyummix:review-changes to review my latest changes.

Scope:
- If no explicit scope is provided, review unpushed commits plus uncommitted changes.
- You may also use:
  - <N> for last N commits
  - <A..B> for an explicit commit range

Domain delegation:
- Route changed files to specialized domain skills ($yummyyummix:frontend, $yummyyummix:backend, $yummyyummix:ai-engineer, $yummyyummix:database) for deeper review.
- Always run $yummyyummix:code-reviewer on all files for cross-cutting concerns.

Evaluate against all 9 review categories in docs/agent-guidelines/REVIEW-CRITERIA.md:
1. Architecture & Design
2. Correctness
3. Security
4. Performance
5. Code Quality
6. Testing
7. i18n
8. Commit Hygiene
9. Documentation

Output requirements:
- Constructive feedback with explicit acknowledgment of good patterns.
- Findings with file path, line references, severity (Critical/Warning/Suggestion), and fix recommendation.
- For Critical findings: provide 2-3 options with effort, risk, impact, maintenance burden; put recommended option first.
- Warning findings that materially affect readiness should also include options.
- Summary with severity counts and readiness recommendation (READY FOR PR / QUICK FIXES THEN PR / NEEDS WORK).
- Recommendations section: high-value improvements outside Findings, ranked by impact vs effort. Do NOT repeat Findings.
- Potential Misses section for uncertainty areas and extra validation.
- Next Steps section: self-contained prompt where Critical/Warning findings are "Fix All", while Suggestions and Recommendations are "Implement If Worthwhile".
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
