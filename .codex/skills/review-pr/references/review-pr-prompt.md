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
- Recommendations section with prioritized, high-value improvements
- Potential Misses section listing uncertainty areas and what to validate
- Next-Step Agent Prompt section for follow-up implementation
- Summary counts by severity
- Final recommendation: APPROVE, COMMENT, or REQUEST CHANGES

Follow-up execution guidance:
- Instruct the implementation agent to create an implementation plan first.
- Then implement only fixes/recommendations that are worth doing for the PR objective.
- Explicitly list deferred items and why they were skipped.
```

## Example Invocation

```text
Use $yummyyummix:review-pr to evaluate pull request #128 and prioritize security and test coverage findings.
Include Recommendations, Potential Misses, and a Next-Step Agent Prompt.
In the agent prompt, require plan-first execution and selective implementation of high-value items only.
```
