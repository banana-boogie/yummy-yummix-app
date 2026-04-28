# Architecture Decision Records (ADRs)

This folder captures **one decision per file**. ADRs are how we record non-obvious technical and product-engineering choices so that, six months from now, we can answer "why does it work this way?" without git archaeology.

## When to write an ADR

Write one when **all** of these are true:

1. The decision is non-obvious or counterintuitive — a future contributor (or AI agent) would reasonably want to do it differently.
2. The decision has cross-cutting consequences — it shapes more than the file you're editing.
3. The reasoning would be lost if you only wrote a code comment.

Skip an ADR for:

- Routine implementation choices (which library to import, how to name a variable).
- Decisions already documented elsewhere (CLAUDE.md, guideline docs, CONTEXT.md).
- Reversible UI tweaks.

Examples in this codebase that **deserve** an ADR:

- "AI Gateway uses OpenAI's request format as the universal interface."
- "No cross-language fallback between `en` and `es` translations."
- "`es` stores base Mexican Spanish; regional codes are override-only."
- "Service-role keys must never be fetched via MCP."
- "Meal-plan ranking prioritizes Thermomix-tagged recipes."

## File naming

`YYYY-MM-DD-kebab-case-title.md` is the long form, but the existing files in this folder use plain kebab-case (`ai-model-selection.md`). Either is fine — keep it short and searchable.

## Template

```markdown
# [Short title in title case]

**Date:** YYYY-MM-DD
**Status:** Accepted | Superseded by [link] | Deprecated

## Context

What forced this decision? Constraints, trade-offs, prior pain. Two or three paragraphs at most.

## Decision

What we chose, in plain language. Lead with the rule, then any nuance.

## Consequences

What this enables. What it costs. What becomes harder. What we have to live with.

## Alternatives considered

(Optional) Other options we weighed and why we rejected them.
```

## Lifecycle

- ADRs are immutable once accepted. If a decision changes, write a **new** ADR and mark the old one `Superseded by [new ADR]`.
- Reference ADRs from code comments only when the *why* is genuinely needed at the call site. Otherwise let the ADR live in this folder.
- When CLAUDE.md or a guideline doc states a rule that has an ADR backing it, link to the ADR so the reasoning is one click away.
