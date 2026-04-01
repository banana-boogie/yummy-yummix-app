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

Output requirements:
- Human-readable summary: Verdict (READY FOR PR/QUICK FIXES THEN PR/NEEDS WORK with severity counts), Highlights, flat Issues list by severity
- Detailed Next Steps prompt for implementation AI: full findings with categories, options/tradeoffs, recommendations, potential misses
- Keep the human section short — all detail goes in Next Steps
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
