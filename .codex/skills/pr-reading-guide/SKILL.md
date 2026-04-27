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

**MUST-READ — always include if changed:**
- Database migrations (`yyx-server/supabase/migrations/`)
- RLS policies, auth flows, JWT/session handling
- Edge function entrypoints (new routes, changed request/response shape)
- Payment, billing, or subscription paths
- New env vars, config flags, secrets
- Security-relevant code (input validation, rate limiting, CORS, sanitization)
- Cron jobs, scheduled tasks, queue workers
- New external service integrations (API keys, webhooks)
- Shared types or top-level data model changes that ripple
- Core product loop on the planner: Mi Menú generation, shopping list assembly, recipe metadata pipeline
- AI gateway changes (`_shared/ai-gateway/`, tool registry, RAG retrievers)

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

Write the file to `/tmp/pr-reading-guide-<PR_NUMBER>.md`:

````markdown
# PR Reading Guide: #<number> — <title>

**Branch:** `<head>` → `<base>` | <file count> files | +<additions> -<deletions>
**Generated:** <ISO date>

## TL;DR

<2–3 sentences in plain English describing intent, not commit-log restatement.>

## What to Manually Verify

- 3–7 bullets, each a concrete verifiable claim (not vague concerns).

## Must-Read Files

### `<path>`

**What changed:** Plain-English description of behavior change, not function-by-function.

**Why it matters:** The decision encoded. What would break or behave differently if wrong.

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
- Each MUST-READ section should fit on a short screen. If you need more than that, recommend the user read the actual code instead — and say so.
- Use the project's domain vocabulary (Mi Menú, Sofía, Lupita, planner, shopping list, Irmixy) where relevant — see `CLAUDE.md`.
- Distinguish what the diff says from what is inferred. Mark inferences as such.
- Surface what surprised you in the report-back; escalate to `$review-pr` when the diff has critical-severity smells (security, data loss, breaking API change).

## When NOT to Use

- Full severity-tagged code review → use `$review-pr`.
- Cross-PR status summary → use `$status-update`.
- The user wants to read the actual code — this skill is for skipping that, not removing the option.

For a reusable invocation template, see `references/pr-reading-guide-prompt.md`.
