---
name: triage-review
description: Triage code review findings — agree/disagree on each, classify as must-fix/verify/skip/optional, and produce a handoff prompt for the implementing AI
argument-hint: Paste review findings, or leave blank to use the most recent /review-changes output
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
2. **Worth fixing in this PR?** — Severity vs effort, real bug vs style preference, in scope?
3. **Verdict** — one of:
   - **Must fix** — real, in-scope, has clear ROI for this PR.
   - **Verify** — not a code change; a coordination/sequencing/state check before merge (e.g. "confirm PR #54 merged first").
   - **Defer** — legitimate issue but out of scope for this PR; goes to a follow-up.
   - **Skip** — wrong, style-only, low value, or already covered.
   - **Optional** — nice-to-have, take it or leave it.

Also triage any **Recommendations** with the same logic.

### Step 3: Output the Triage Report

The report has **two parts**: a human-readable summary the user actually reads, and a handoff prompt for the implementing AI. **The human part is for skimming. The handoff prompt holds the technical detail.**

#### Output template

````markdown
## Triage Report

**Findings reviewed:** <count> | **Must fix:** <n> | **Verify:** <n> | **Defer:** <n> | **Skip:** <n> | **Optional:** <n>

**Overall:** <1-2 sentences in plain language: are these changes in good shape, what's the gist of what's getting fixed, and is anything blocking merge?>

### Triage at a Glance

One row per finding, sorted by verdict in this order: Must fix → Verify → Defer → Skip → Optional. Numbers (#) are reused in the Handoff Prompt. Area is one of: Frontend, Backend, Database, AI, Infra, Docs, i18n, Tests.

| # | Verdict   | Sev      | Area     | File                 | Issue (plain-language)              |
|---|-----------|----------|----------|----------------------|-------------------------------------|
| 1 | Must fix  | High     | <area>   | `file:line`          | <6-12 word user-facing headline>    |
| 2 | Verify    | High     | <area>   | `file:line`          | <6-12 word headline>                |
| 3 | Defer     | High     | <area>   | `file:line`          | <6-12 word headline>                |
| 4 | Skip      | Warning  | <area>   | `file:line`          | <6-12 word headline>                |

### Verdict Notes

For each finding, give a **concept-first one-liner** (what this means for the product or the user) and an **indented technical sub-bullet** with the file/function pointer and the mechanic. Detail beyond that goes in the Handoff Prompt — not here.

- **#1 Must fix** — New users skip wizard steps they never answered.
  - `FirstTimePlanSetupFlow.tsx:95` — step-skip logic trusts populated arrays from `DEFAULT_PREFERENCES`; doesn't gate on `setupCompletedAt`.
- **#2 Verify** — Don't merge this PR before its backend dependency lands.
  - `types/mealPlan.ts:117` — depends on fields from PR #54 (`setupCompletedAt`, `selectedRecipeId`); confirm PR #54 is merged to main first.
- **#3 Defer** — "Mark cooked" looks supported but no UI path actually triggers it.
  - `TodayHero.tsx:185` + `cooking-guide/[step].tsx` — threading `mealPlanSlotId` through the cook flow is a separate task; document as a known limitation, push to a follow-up.

Prose rules for this section:
- **Lead with the user/product consequence, not the API.** "Failed removes are silent" beats "skipSlot called without await/catch."
- One sentence per top-level bullet, max ~20 words.
- No file paths or function names in the top-level bullet — those live in the indented sub-bullet.
- Drop entries that can only be expressed technically — they're not interesting at this layer; they live in the Handoff Prompt.

---

### Handoff Prompt

> Copy-paste the block below into the implementing AI.

```text
Review the findings below and implement all Must Fix items. Verify items are not code changes — perform the check and report results. Defer and Skip items are not in scope for this PR.

Finding numbers (#N) match the "Triage at a Glance" table.

## Must Fix

- **#1** [Severity] `file:line` — <concrete description of what's wrong>
  - Do: <specific action with file/function/line and the exact change>
  - Test: <what to add or run to confirm the fix>

## Verify Before Merge (Not Code)

- **#2** [Severity] `file:line` — <what coordination check is needed>
  - Do: <command or check to run, e.g. `gh pr view 54 --json state,mergedAt`>
  - Block on: <condition that must hold before merging>

## Out of Scope (Defer)

- **#3** [Severity] `file:line` — <what's broken/missing and why it's out of scope>
  - Do NOT change: <files/areas to leave alone>
  - Follow-up: <where to log the deferred work — plan file, issue, PR description update>

## Recommended Improvements

- **#N** `file:line` — <what to do>

## Workflow

1. Read the relevant files to understand context.
2. Implement all "Must Fix" items.
3. Run any "Verify Before Merge" checks and report results.
4. Update PR description / follow-up plans for "Defer" items as instructed.
5. Run tests and type-checks for changed areas.
6. Report what was done.

Constraints:
- Keep changes scoped to the items above.
- Do not modify files listed under "Out of Scope".
- Avoid unrelated refactors.
```
````

### Key Principles

- **Be skeptical of style-only findings** — If the code works, is readable, and follows project conventions, a style preference from the reviewer is a Skip.
- **Protect the implementer's time** — Every Must fix should have clear ROI. Don't send busywork.
- **Upgrade severity when needed** — If the reviewer marked something as Suggestion but it's actually a bug, escalate to Must fix.
- **Downgrade severity when needed** — If a Warning is really just a style preference or minor nitpick with no real impact, downgrade to Skip or Optional.
- **Context matters** — An admin-only dashboard has different quality bars than a user-facing feature.
- **Prose for humans, detail for the AI** — The triage table + concept-first notes are for the user skimming. The Handoff Prompt is where the API names, line numbers, and exact diffs live.
- **The Handoff Prompt is the deliverable for the implementer** — The triage is for the user; the Handoff Prompt is what gets sent to the implementing AI.
