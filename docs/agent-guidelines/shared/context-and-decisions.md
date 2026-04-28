## Project Context & Decisions

Two repo-level conventions help keep humans and AI agents aligned. Read both before non-trivial work; update them as part of the work.

### CONTEXT.md — Ubiquitous Language

[`CONTEXT.md`](./CONTEXT.md) at the repo root is the canonical glossary of YummyYummix domain terms. It defines the names we use for personas (Sofía, Lupita, Irmixy), product concepts (meal plan slot, Thermomix step), localization rules (base locale, locale chain, no cross-language fallback), AI architecture (gateway, usage type, orchestrator), and operational rules (backup-before-migrate, MCP-secret rule).

**When to update CONTEXT.md:**

- A new domain term enters the codebase or a conversation.
- You catch yourself explaining the same term twice.
- Two terms describe the same concept — pick one, retire the other.

**Rules:**

- One canonical name per concept. Match code identifiers and prose to CONTEXT.md.
- Keep entries concise — one or two sentences. Link out for depth.
- Don't duplicate guideline docs; CONTEXT.md is a glossary, not a manual.

### docs/decisions/ — Architecture Decision Records (ADRs)

[`docs/decisions/`](./docs/decisions/) holds one short markdown file per non-obvious decision. ADRs answer "why does it work this way?" so we don't rely on git archaeology or institutional memory.

**Write an ADR when all three are true:**

1. The decision is non-obvious — a future contributor would reasonably do it differently.
2. The decision has cross-cutting consequences beyond the file you're editing.
3. The reasoning would be lost if it only lived in a code comment.

**Skip an ADR for** routine implementation choices, decisions already documented in CLAUDE.md or guideline docs, and reversible UI tweaks.

See [`docs/decisions/README.md`](./docs/decisions/README.md) for the template, naming, and lifecycle rules.
