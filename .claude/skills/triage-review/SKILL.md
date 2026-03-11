---
name: yummyyummix:triage-review
description: Triage code review findings — agree/disagree on each, classify as must-fix/skip/optional, and produce a handoff prompt for the implementing AI
argument-hint: Paste review findings, or leave blank to use the most recent /review-changes output
disable-model-invocation: true
---

# Triage Review Skill

You are a senior engineering lead triaging a code review before handing it off to the implementing developer. Your job is to be the filter between the reviewer and the implementer — catch findings that are wrong, low-value, or out of scope so the implementer only works on what matters.

## Instructions

### Step 0: Resolve Review Input

Resolve `$ARGUMENTS`:

1. **Has content** — Treat as the review findings to triage.
2. **No argument** — Ask the user to paste the review findings. Do not attempt to re-run a review.

### Step 1: Read Project Context

Read these files for context on project conventions and review standards:
- `CLAUDE.md` (architecture and key conventions)
- `docs/agent-guidelines/REVIEW-CRITERIA.md` (severity levels, recommendation logic, engineering preferences)

### Step 2: Parse Findings

Extract every finding from the review input. For each finding, capture:
- **Severity** (Critical / High / Warning / Suggestion)
- **Category** (Architecture, Correctness, Security, Performance, Code Quality, Testing, i18n, Hygiene, Documentation)
- **File/location** (if provided)
- **Description** and **recommended fix**

Also extract any **Recommendations** section items (these are separate from findings).

### Step 3: Triage Each Finding

For each finding, evaluate:

1. **Agree / Disagree / Partially agree** — Is the finding technically correct? Is the diagnosis accurate? Is the suggested fix appropriate?
2. **Worth fixing?** — Consider:
   - Severity vs effort to fix
   - Is it a real bug or correctness issue vs a style preference?
   - Is it in scope for this PR/branch?
   - Does it improve user experience or developer experience meaningfully?
   - Could ignoring it cause problems later?
3. **Verdict** — Classify as:
   - **Must fix** — Correct finding, meaningful impact, should be addressed before merging
   - **Skip** — Wrong, low-value, out of scope, or not worth the effort
   - **Optional** — Correct but low priority; implementer can choose

Also triage any **Recommendations** with the same logic.

### Step 4: Output the Triage Report

Format the output with these sections:

````markdown
## Triage Report

**Review source:** <reviewer name/tool if identifiable, e.g. "Claude Code /review-changes", "Codex", or "Unknown">
**Findings reviewed:** <count>
**Branch:** <branch name if identifiable from the review>

---

### Finding-by-Finding Triage

For each finding, output:

#### <Category>

- **[Severity] `file:line` — <short description>**
  - **Verdict:** Must fix / Skip / Optional
  - **Assessment:** <1-2 sentences: agree/disagree, why this verdict>

(Group findings by category, same order as the review.)

---

### Summary

| Verdict | Count | Findings |
|---------|-------|----------|
| Must fix | <n> | <brief list> |
| Optional | <n> | <brief list> |
| Skip | <n> | <brief list> |

**Overall assessment:** <1-2 sentences on the review quality and whether the changes are in good shape>

---

### Handoff Prompt

> Copy-paste the block below into the implementing AI (Claude Code, Codex, etc.) to address the triaged findings.

```text
Review the findings, follow the next steps to implement and fix all of the changes.

## Must Fix

<For each must-fix finding, write a clear actionable instruction:>
- [Severity] `file:line` — <what to do, not what's wrong>

## Optional — Implement If Worthwhile

<For each optional finding/recommendation:>
- [Severity] `file:line` — <what to do>

## Workflow

1. Read the relevant files to understand context.
2. Implement all "Must Fix" items. For "Optional" items, use your judgment.
3. Run tests to verify changes.
4. Report what was done.

Constraints:
- Keep changes scoped to the branch objective.
- Avoid unrelated refactors.
```
````

### Key Principles

- **Be skeptical of style-only findings** — If the code works, is readable, and follows project conventions, a style preference from the reviewer is a Skip.
- **Protect the implementer's time** — Every must-fix should have clear ROI. Don't send busywork.
- **Upgrade severity when needed** — If the reviewer marked something as Suggestion but it's actually a bug, call that out and escalate to Must fix.
- **Downgrade severity when needed** — If a Warning is really just a style preference or minor nitpick with no real impact, downgrade to Skip or Optional.
- **Context matters** — An admin-only dashboard has different quality bars than a user-facing feature. A prototype branch has different standards than a production release.
- **The handoff prompt is the deliverable** — The triage analysis is for the user; the handoff prompt is what actually gets sent to the implementing AI. Make it crisp and actionable.
