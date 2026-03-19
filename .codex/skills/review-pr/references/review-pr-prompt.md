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

Output requirements:
- Human-readable summary: Verdict (APPROVE/COMMENT/REQUEST CHANGES with severity counts), Highlights, flat Issues list by severity
- Detailed Next Steps prompt for implementation AI: full findings with categories, options/tradeoffs, recommendations, potential misses
- Keep the human section short — all detail goes in Next Steps
```

## Example Invocation

```text
Use $yummyyummix:review-pr to evaluate pull request #128 and prioritize security and test coverage findings.
```

```text
Use $yummyyummix:review-pr.
If a PR is linked to my current branch, ask me to confirm that PR before starting the review.
If you cannot resolve the branch PR after retry, ask me for explicit PR number/URL.
```
