# PR Review Prompt Template

Use this prompt when invoking the skill directly:

```text
Use $yummyyummix:review-pr to evaluate pull request <PR_NUMBER_OR_URL>.

Collection behavior:
- Try `gh pr view`, `gh pr diff`, and `gh pr checks` first.
- If GitHub API/GraphQL calls fail (throttling/deprecation/transient errors), fallback to git-based comparison using fetched base/head branches.

Focus areas:
- Architecture and design fit
- Correctness and regression risk
- Security risks (RLS, auth, validation, secrets)
- Test coverage gaps
- Performance concerns
- Documentation quality and missing updates
- Project conventions and PR hygiene

Output requirements:
- Good Patterns Observed section (constructive positives)
- Findings grouped by category
- Each finding tagged as Critical, Warning, or Suggestion
- Evidence with file paths and lines where possible
- Every finding includes a concrete recommendation
- For Critical findings and merge-risk Warning findings:
  - include 2-3 options
  - include effort/risk/impact/maintenance for each option
  - put recommended option first
- Recommendations section with prioritized, high-value improvements
- Recommendations must be ranked by impact vs complexity
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
Include Good Patterns Observed, Documentation findings, ranked Recommendations, Potential Misses, and a Next-Step Agent Prompt.
In the agent prompt, require plan-first execution and selective implementation of high-value items only.
```
