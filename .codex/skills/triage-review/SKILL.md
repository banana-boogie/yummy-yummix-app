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

### Step 2: Parse and Triage Findings

Extract every finding from the review input. For each finding, evaluate:

1. **Agree / Disagree / Partially agree** — Is the finding technically correct?
2. **Worth fixing?** — Severity vs effort, real bug vs style preference, in scope?
3. **Verdict** — Must fix / Skip / Optional

Also triage any **Recommendations** with the same logic.

### Step 3: Output the Triage Report

The report has **two sections**: a human-readable summary, then a handoff prompt for the implementing AI.

````markdown
## Triage Report

**Findings reviewed:** <count> | **Must fix:** <n> | **Optional:** <n> | **Skip:** <n>

**Overall:** <1-2 sentences on whether the changes are in good shape>

### Triage

- **[Severity] `file:line` — <short description>** → **Must fix** — <1 sentence why>
- **[Severity] `file:line` — <short description>** → **Skip** — <1 sentence why>
- **[Severity] `file:line` — <short description>** → **Optional** — <1 sentence why>

---

### Handoff Prompt

> Copy-paste the block below into the implementing AI.

```text
Review the findings, follow the next steps to implement and fix all of the changes.

## Must Fix

- [Severity] `file:line` — <what to do, not what's wrong>

## Optional — Implement If Worthwhile

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
- **Context matters** — An admin-only dashboard has different quality bars than a user-facing feature.
- **The handoff prompt is the deliverable** — The triage is for the user; the handoff prompt is what gets sent to the implementing AI.
