# PR Review Prompt Template

Use this prompt when invoking the skill directly:

```text
Use $yummyyummix:review-pr to evaluate pull request <PR_NUMBER_OR_URL>.

Focus areas:
- Architecture and design fit
- Correctness and regression risk
- Security risks (RLS, auth, validation, secrets)
- Test coverage gaps
- Performance concerns
- Project conventions and PR hygiene

Output requirements:
- Findings grouped by category
- Each finding tagged as Critical, Warning, or Suggestion
- Evidence with file paths and lines where possible
- Summary counts by severity
- Final recommendation: APPROVE, COMMENT, or REQUEST CHANGES
```

## Example Invocation

```text
Use $yummyyummix:review-pr to evaluate pull request #128 and prioritize security and test coverage findings.
```
