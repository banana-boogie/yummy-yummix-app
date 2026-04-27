---
name: pr-reading-guide
description: Use when preparing to merge a PR and the user wants to manually review the high-judgment files without reading the full diff. Generates a temporary markdown document explaining each must-read file in prose so the user can review intent rather than code.
---

# PR Reading Guide Skill

Generate a human-friendly reading guide for PR #$ARGUMENTS that surfaces the files actually worth a manual eyeball review and explains each in prose so the user doesn't have to read the code.

## Instructions

You are producing a *reading guide*, not a code review. The output is a temporary markdown file the user reads before clicking merge. Follow these steps exactly.

### Step 1: Resolve the PR

If `$ARGUMENTS` is empty or not a number:
- Resolve PR for current branch:
  ```bash
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
  gh pr list --head "$CURRENT_BRANCH" --state open --limit 1 --json number,url,title,headRefName,baseRefName
  ```
- Confirm with the user before proceeding.
- If no PR found, ask the user for an explicit PR number or URL.

### Step 2: Gather Context

```bash
gh pr view $ARGUMENTS --json number,title,author,headRefName,baseRefName,body,changedFiles,additions,deletions
gh pr diff $ARGUMENTS
gh pr view $ARGUMENTS --json files --jq '.files[].path'
```

### Step 3: Triage Files into Three Buckets

Apply heuristics first, then layer LLM judgment for this specific PR.

**MUST-READ — always include if changed:**
- Database migrations (`yyx-server/supabase/migrations/`)
- RLS policies, auth flows, JWT/session handling
- Edge function entrypoints (new routes, changed request/response shape)
- Payment, billing, or subscription code paths
- New env vars, config flags, secrets handling
- Security-relevant code (input validation, rate limiting, CORS, sanitization)
- Cron jobs, scheduled tasks, queue workers
- New external service integrations (API keys, webhooks)
- Top-level data model / schema / shared types changes that ripple across the app
- Files touching the core product loop on the planner: Mi Menú generation, shopping list assembly, recipe metadata pipeline
- AI gateway changes (`_shared/ai-gateway/`, tool registry, RAG retrievers)

**SKIM — include only if the LLM judges them load-bearing for this PR:**
- Larger feature components or hooks with non-obvious logic
- Refactors that change call sites widely
- New utilities used in many places
- i18n changes that affect copy meaning (not just translation key adds)

**SKIP — never include in the guide:**
- Lockfiles, generated types, build artifacts
- Pure formatting / lint-only changes
- Tests that mirror their implementation 1:1 (mention test *coverage* in summary, but don't list each test file)
- Snapshot updates
- Asset additions (images, fonts)
- Translation files when they only add already-existing keys in another locale

**LLM judgment layer (do this, don't skip):**
After applying heuristics, look at the diff and ask: which files in this PR encode a *decision* the user would want to validate? Things like:
- A new control-flow branch that changes user-visible behavior
- A choice of default value, threshold, or fallback
- A non-obvious reason for ordering, batching, or retrying
- A trade-off between two reasonable approaches
- Anything you, as the implementer, would want a second pair of eyes on

Promote those into MUST-READ even if they don't match a heuristic. Demote heuristic matches that turned out to be trivial (e.g., a migration that just renames a column).

### Step 4: Write the Reading Guide

**Before writing:** for each MUST-READ file, open the file at HEAD and read the surrounding code, not just the diff hunks. The Walkthrough must reflect the file's full behavior *after* the change, not only the lines that moved. If a function is called but not changed, you still need to know what it does to describe the flow accurately.

Output to `/tmp/pr-reading-guide-<PR_NUMBER>.md` (overwrite if exists). Tell the user the path when done.

Structure:

````markdown
# PR Reading Guide: #<number> — <title>

**Branch:** `<head>` → `<base>` | <file count> files | +<additions> -<deletions>
**Generated:** <ISO date>

## TL;DR

<2-3 sentence plain-English summary of what this PR does and why. Not a commit-message restatement — explain the *intent*.>

## How These Files Fit Together

A short paragraph (or numbered flow) showing the call graph across the must-read files: where a request/event enters, which file routes it, which mutates state, what comes back. Skip this section if there is only one must-read file.

## What to Manually Verify

Bulleted list of the 3–7 things the user should actively check before merging. Each bullet is a verifiable claim, not a vague concern. Example: "Confirm the new `recipe_metadata.cuisine` column allows NULL — older rows have no cuisine yet."

## Must-Read Files

For each MUST-READ file, one section:

### `<path>`

**What changed:** 1–2 orienting sentences. Not "added function X" — "now we route Sofía's planner request through the new recipe-metadata cache before falling back to the database."

**Walkthrough:** Detailed prose explanation of the file's logic after the change. Walk through the functions/blocks in execution order: inputs, what each step does, the branches that exist, the edge cases handled, the values returned. Be specific — the reader should be able to describe the code's behavior back to you afterwards. For changed (not new) files, include explicit **Before:** / **After:** contrast so the delta is obvious. Prefer prose, but quote a short snippet (≤5 lines) when the literal code — a regex, SQL clause, default value, key constant — is shorter and clearer than describing it. If you had to infer behavior because you couldn't fully resolve a helper or callee, say so at the end of this section.

**Decisions encoded:** Bullet list of the non-obvious choices in this file — defaults, thresholds, fallbacks, ordering, retries, why approach A over B. One bullet per decision. This is what the user is actually validating.

**Call sites / blast radius:** For shared utilities, types, services, or hooks, list who calls this file and how. Skip this block for leaf files that aren't imported elsewhere.

**Data shapes:** When the file touches DB rows, request/response payloads, or shared types, inline the actual shape (column types and nullability, JSON structure, prop interface). Skip this block when not relevant.

**What to verify:** Concrete check the user can do without reading code — e.g., "Open Supabase, confirm the `idx_recipe_meta_cuisine` index exists" or "Test the planner with a recipe that has no cuisine and confirm it doesn't error."

**Risk if wrong:** One sentence — what's the blast radius?

## Skim Files

Bulleted list. One line each: `path` — one-sentence reason it's worth a glance.

## Skipped (For Reference)

Brief mention of categories skipped, so the user knows nothing was hidden:
- N test files mirroring impl
- M generated/lockfile/translation entries
- etc.

## Open Questions

Anything the LLM couldn't determine from the diff alone — call these out so the user knows where confidence is lower.
````

### Step 5: Report Back

After writing, send the user a short message with:
1. The path to the generated guide
2. A one-line summary (e.g., "4 must-read files, 2 skim, 11 skipped")
3. Anything in the diff that surprised you and might warrant escalating to a full PR review instead

## Tone and Length

- The reading guide replaces reading code, so prose must be specific and concrete. Vague summaries ("this refactors the planner") are useless.
- Be as long as needed to faithfully describe the code. Do not artificially compress — if a file has real complexity, the Walkthrough should cover it. If a file is huge but mostly mechanical (e.g., a long switch with repetitive branches), summarize the mechanical parts and go deep on the load-bearing logic.
- Distinguish what the diff/code says from what you inferred. Mark inferences as such inside the Walkthrough.
- Use the user's domain vocabulary (Mi Menú, Sofía, Lupita, planner, shopping list, Irmixy) when relevant — they're already in `CLAUDE.md`.

## When NOT to Use This Skill

- For full code review with severity-tagged findings → use `review-pr` instead.
- For a status update on what changed across many PRs → use `status-update`.
- When the user wants to read the actual code — this skill is for skipping that step, not replacing the option.
