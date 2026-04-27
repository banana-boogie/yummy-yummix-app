# PR Reading Guide Prompt Template

Use this prompt when invoking the skill directly:

```text
Use $pr-reading-guide to generate a reading guide for pull request <PR_NUMBER_OR_URL>.
If no PR argument is provided, resolve the PR for the current branch and ask me to confirm before generating.

Triage the changed files into MUST-READ, SKIM, and SKIP using the heuristics in the skill.
Then layer LLM judgment: promote any file that encodes a decision worth validating, demote any heuristic match that turned out trivial.

Write the guide to /tmp/pr-reading-guide-<PR_NUMBER>.md.

Output requirements:
- TL;DR explaining intent, not commit-log restatement
- "What to Manually Verify" bullets — each a concrete check
- One section per must-read file: What changed / Why it matters / What to verify / Risk if wrong
- Each section short enough to fit on a screen — if longer, tell me to read the code
- Skim list with one-line reasons
- Skipped categories so nothing feels hidden
- Open Questions for low-confidence areas

When done, report:
1. Path to the generated guide
2. One-line summary (e.g. "4 must-read, 2 skim, 11 skipped")
3. Anything in the diff that surprised you and might warrant a full $review-pr instead
```

## Example Invocations

```text
Use $pr-reading-guide for PR #248. I want to manually verify the planner changes before merging.
```

```text
Use $pr-reading-guide.
If a PR is linked to my current branch, ask me to confirm before generating the guide.
```
