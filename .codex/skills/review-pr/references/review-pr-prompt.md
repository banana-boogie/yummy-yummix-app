# PR Review Prompt Template

Use this prompt when invoking the skill directly:

```text
Use $yummyyummix:review-pr to evaluate pull request <PR_NUMBER_OR_URL>.
If no PR argument is provided, resolve the PR for the current branch and ask me to confirm before reviewing.
If branch PR resolution fails due GitHub API/auth issues, retry once, then ask me for explicit PR number/URL (do not use stale previous-session PR context).

Domain delegation:
- Route changed files to specialized domain skills ($yummyyummix:frontend, $yummyyummix:backend, $yummyyummix:ai-engineer, $yummyyummix:database) for deeper review.
- Always run $yummyyummix:code-reviewer on all files for cross-cutting concerns.

Collection behavior:
- Try `gh pr view`, `gh pr diff`, and `gh pr checks` first.
- If GitHub API/GraphQL calls fail (throttling/deprecation/transient errors), fallback to git-based comparison using fetched base/head branches.

Focus areas:
- Architecture and design fit
- Correctness and regression risk
- Security risks (RLS, auth, validation, secrets)
- Performance concerns
- Code quality (dead code, DRY, conventions)
- Test coverage gaps
- i18n coverage (no hardcoded strings, en/es parity)
- PR hygiene and scope quality
- Documentation quality and missing updates

Output requirements:
- Highlights section (constructive positives)
- Findings grouped by all 9 categories:
  - Architecture & Design
  - Correctness
  - Security
  - Performance
  - Code Quality
  - Testing
  - i18n
  - PR Hygiene
  - Documentation
- Each finding tagged as Critical, Warning, or Suggestion
- Evidence with file paths and lines where possible
- Every finding includes a concrete recommendation
- For Critical findings and merge-risk Warning findings:
  - include 2-3 options
  - include effort/risk/impact/maintenance for each option
  - put recommended option first
- Summary with severity counts and recommendation (APPROVE / COMMENT / REQUEST CHANGES)
- Recommendations section: high-value improvements outside Findings, ranked by impact vs effort. Do NOT repeat Findings.
- Potential Misses section listing uncertainty areas and what to validate
- Next Steps section: self-contained prompt where Critical/Warning findings are "Fix All", while Suggestions and Recommendations are "Implement If Worthwhile"
```

## Example Invocation

```text
Use $yummyyummix:review-pr to evaluate pull request #128 and prioritize security and test coverage findings.
Include Highlights, Documentation findings, ranked Recommendations (no Findings repeats), Potential Misses, and Next Steps with required vs optional implementation clearly separated.
```

```text
Use $yummyyummix:review-pr.
If a PR is linked to my current branch, ask me to confirm that PR before starting the review.
If you cannot resolve the branch PR after retry, ask me for explicit PR number/URL.
```
