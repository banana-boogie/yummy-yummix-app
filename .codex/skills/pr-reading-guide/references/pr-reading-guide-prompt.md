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
- "How These Files Fit Together" — short call-graph paragraph across must-read files (skip if only one)
- "What to Manually Verify" bullets — each a concrete check
- One section per must-read file with: What changed / Walkthrough (numbered list, one entry per function or logical step in execution order — NOT a single paragraph; ~1–4 lines per entry; with Before/After lines for changed files, ≤5-line snippets when clearer than prose, and `(Inferred — ...)` markers when applicable) / Decisions encoded (bullet list) / Call sites / blast radius (for shared code) / Data shapes (when relevant) / What to verify / Risk if wrong
- Be as long as needed — do not artificially compress; readers must come away with the same mental model they'd have from reading the code
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
