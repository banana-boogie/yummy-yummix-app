---
name: pr-reading-guide
description: Generate a temporary, prose-style reading guide for a pull request that explains each must-read file so the user can validate intent without reading code. Use when preparing to merge a PR and the user wants to manually review the high-judgment files quickly.
---

# PR Reading Guide

## Overview

Produce a human-friendly markdown reading guide for one pull request. The guide replaces reading the diff: for each high-judgment file it explains what changed in plain English, why it matters, what to verify, and the risk if wrong. Output goes to `/tmp/pr-reading-guide-<PR_NUMBER>.md`.

This is **not** a code review. It is a reviewer's reading guide — pre-merge prep so the user can sanity-check intent in 5 minutes instead of reading the full diff.

## Required Inputs

- Optional PR number or URL.
- Repository with GitHub CLI access (`gh`).

If no PR identifier is provided, resolve from the current branch and confirm with the user before continuing.

## PR Target Resolution

1. If a PR number/URL is provided, use it.
2. Otherwise:
   ```bash
   CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
   gh pr list --head "$CURRENT_BRANCH" --state open --limit 1 --json number,url,title,headRefName,baseRefName
   ```
   Ask the user to confirm the resolved PR before proceeding.
3. If neither path resolves, ask the user for an explicit PR number or URL. Do not infer from prior context.

## Workflow

1. Gather context:
   ```bash
   gh pr view <pr> --json number,title,author,headRefName,baseRefName,body,changedFiles,additions,deletions
   gh pr diff <pr>
   gh pr view <pr> --json files --jq '.files[].path'
   ```
2. Triage every changed file into **MUST-READ**, **SKIM**, or **SKIP** using the rules below.
3. Apply LLM judgment on top of the heuristics (see "Judgment Layer" below) — do not just match patterns.
4. Write the reading guide to `/tmp/pr-reading-guide-<PR_NUMBER>.md`.
5. Report the path back to the user with a one-line summary and any surprises that might warrant escalating to a full review.

## Triage Heuristics

**MUST-READ — always include if changed.** Two categories: *always-dangerous infrastructure* (true regardless of what the PR is about) and *this PR's central logic* (the actual behavior being shipped).

*Always-dangerous infrastructure:*
- Database migrations (`yyx-server/supabase/migrations/`)
- RLS policies, auth flows, JWT/session handling
- Edge function entrypoints (new routes, changed request/response shape)
- Payment, billing, or subscription paths
- New env vars, config flags, secrets
- Security-relevant code (input validation, rate limiting, CORS, sanitization)
- Cron jobs, scheduled tasks, queue workers
- New external service integrations (API keys, webhooks)
- Shared types or top-level data model changes that ripple
- AI gateway changes (`_shared/ai-gateway/`, tool registry, RAG retrievers)

*This PR's central logic:*
- **Core business / domain logic** — files encoding product rules: scoring, ranking, eligibility, validation, conversions, state transitions, lifecycle code, search/match algorithms, recipe pipeline transformations, planner ranking, Mi Menú generation, shopping list assembly, recipe metadata pipeline, Irmixy tool-selection logic
- **The PR's headline feature** — the file(s) implementing the main thing the PR is shipping, inferred from the PR title and body. If the PR is "add ingredient substitution", the substitution logic file is MUST-READ even if it's a leaf component with no other heuristic match. The PR's central feature should never be SKIM — that defeats the purpose of the guide.

**SKIM — include only when judged load-bearing for this PR:**
- Larger feature components/hooks with non-obvious logic
- Refactors that change call sites widely
- New utilities used in many places
- i18n changes that alter copy meaning (not just key adds)

**SKIP — never include:**
- Lockfiles, generated types, build artifacts
- Pure formatting / lint-only changes
- Tests that mirror their implementation 1:1
- Snapshot updates
- Asset additions
- Translation files that only add already-existing keys in another locale

## Judgment Layer

After heuristic triage, look at the diff and identify files that encode a **decision** the user should validate:

- A new control-flow branch that changes user-visible behavior
- A choice of default value, threshold, or fallback
- A non-obvious reason for ordering, batching, retrying
- A trade-off between two reasonable approaches
- Anything you, as the implementer, would want a second pair of eyes on

Promote those into MUST-READ even if they don't match a heuristic. Demote heuristic matches that turned out trivial (e.g., a migration that only renames a column).

## Output Format

**Before writing:** for each MUST-READ file, open the file at HEAD and read the surrounding code, not just the diff hunks. The Walkthrough must reflect the file's full behavior *after* the change, not only the lines that moved. If a function is called but not changed, you still need to know what it does to describe the flow accurately.

Write the file to `/tmp/pr-reading-guide-<PR_NUMBER>.md`:

````markdown
# PR Reading Guide: #<number> — <title>

**Branch:** `<head>` → `<base>` | <file count> files | +<additions> -<deletions>
**Generated:** <ISO date>

## TL;DR

<2–3 sentences in plain English describing intent, not commit-log restatement.>

## How These Files Fit Together

A short paragraph (or numbered flow) showing the call graph across the must-read files: where a request/event enters, which file routes it, which mutates state, what comes back. Skip this section if there is only one must-read file.

## What to Manually Verify

- 3–7 bullets, each a concrete verifiable claim (not vague concerns).

## Must-Read Files

### `<path>`

**What changed:** 1–2 orienting sentences in plain English. Not function-by-function.

**Walkthrough:** Step-by-step breakdown of the file's logic after the change. **Use a numbered list, with one entry per function, block, or logical step in execution order** — not a single paragraph. Each entry should be a short bullet covering: inputs received, what happens, branches/edge cases, what's returned. Aim for ~1–4 lines per entry. The reader should be able to describe the code's behavior back to you afterwards.

After the numbered list, when applicable:
- For changed (not new) files: end with explicit **Before:** / **After:** lines describing the delta.
- Quote a code snippet (≤5 lines) only when the literal code — a regex, SQL clause, default value, key constant — is clearer than prose; place it inline next to the step it belongs to.
- If you had to infer behavior because you couldn't fully resolve a helper or callee, mark that step with `(Inferred — <reason>)` rather than presenting the inference as fact.

**Decisions encoded:** Bullet list of the non-obvious choices in this file — defaults, thresholds, fallbacks, ordering, retries, why approach A over B. One bullet per decision. This is what the user is actually validating.

**Call sites / blast radius:** For shared utilities, types, services, or hooks, list who calls this file and how. Skip this block for leaf files that aren't imported elsewhere.

**Data shapes:** When the file touches DB rows, request/response payloads, or shared types, inline the actual shape (column types and nullability, JSON structure, prop interface). Skip this block when not relevant.

**What to verify:** A check the user can do without reading the code — UI test, Supabase inspection, log check, etc.

**Risk if wrong:** One sentence — blast radius.

## Skim Files

- `<path>` — one-sentence reason to glance.

## Skipped (For Reference)

Categories skipped so nothing seems hidden:
- N test files mirroring impl
- M generated/lockfile/translation entries

## Open Questions

Anything the diff alone could not determine — call out lower-confidence areas.
````

## Quality Rules

- Prose must be **specific**. The guide replaces reading code; vague summaries defeat the purpose.
- Be as long as needed to faithfully describe the code. Do not artificially compress — if a file has real complexity, the Walkthrough should cover it. If a file is huge but mostly mechanical (e.g., a long switch with repetitive branches), summarize the mechanical parts and go deep on the load-bearing logic.
- Use the project's domain vocabulary (Mi Menú, Sofía, Lupita, planner, shopping list, Irmixy) where relevant — see `CLAUDE.md`.
- Distinguish what the diff says from what is inferred. Mark inferences as such inside the Walkthrough.
- Surface what surprised you in the report-back; escalate to `$review-pr` when the diff has critical-severity smells (security, data loss, breaking API change).

## When NOT to Use

- Full severity-tagged code review → use `$review-pr`.
- Cross-PR status summary → use `$status-update`.
- The user wants to read the actual code — this skill is for skipping that, not removing the option.

For a reusable invocation template, see `references/pr-reading-guide-prompt.md`.
