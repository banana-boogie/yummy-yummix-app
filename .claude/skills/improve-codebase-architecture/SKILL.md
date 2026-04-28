---
name: improve-codebase-architecture
description: Find deepening opportunities in the YummyYummix codebase, informed by the domain language in CONTEXT.md and the decisions in docs/decisions/. Use when the user wants to improve architecture, find refactoring opportunities, consolidate tightly-coupled modules, or make a codebase more testable and AI-navigable.
---

# Improve Codebase Architecture

Surface architectural friction and propose **deepening opportunities** — refactors that turn shallow modules into deep ones. The aim is testability and AI-navigability.

This skill is *informed* by the project's domain model. The domain language gives names to good seams; ADRs record decisions the skill should not re-litigate.

## Glossary

Use these terms exactly in every suggestion. Consistent language is the point — don't drift into "component," "service," "API," or "boundary." Full definitions in [LANGUAGE.md](LANGUAGE.md).

- **Module** — anything with an interface and an implementation (function, class, package, slice).
- **Interface** — everything a caller must know to use the module: types, invariants, error modes, ordering, config. Not just the type signature.
- **Implementation** — the code inside.
- **Depth** — leverage at the interface: a lot of behaviour behind a small interface. **Deep** = high leverage. **Shallow** = interface nearly as complex as the implementation.
- **Seam** — where an interface lives; a place behaviour can be altered without editing in place. (Use this, not "boundary.")
- **Adapter** — a concrete thing satisfying an interface at a seam.
- **Leverage** — what callers get from depth.
- **Locality** — what maintainers get from depth: change, bugs, knowledge concentrated in one place.

Key principles:

- **Deletion test**: imagine deleting the module. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it was earning its keep.
- **The interface is the test surface.**
- **One adapter = hypothetical seam. Two adapters = real seam.**

## Process

### 1. Explore

Before exploring, **read [`CONTEXT.md`](../../../CONTEXT.md) and skim [`docs/decisions/`](../../../docs/decisions/)**. The first gives you the project's vocabulary; the second tells you which architectural choices are already settled and shouldn't be relitigated.

Then walk the codebase. For broad exploration, dispatch a sub-agent via the Agent tool with `subagent_type=Explore` (the built-in Claude Code search agent — not a project agent in `.claude/agents/`). Don't follow rigid heuristics — explore organically and note where you experience friction:

- Where does understanding one concept require bouncing between many small modules?
- Where are modules **shallow** — interface nearly as complex as the implementation?
- Where have pure functions been extracted just for testability, but the real bugs hide in how they're called (no **locality**)?
- Where do tightly-coupled modules leak across their seams?
- Which parts of the codebase are untested, or hard to test through their current interface?

Apply the **deletion test** to anything you suspect is shallow: would deleting it concentrate complexity, or just move it? A "yes, concentrates" is the signal you want.

YummyYummix-specific places worth examining:
- **AI Gateway and orchestrators** (`yyx-server/supabase/functions/_shared/ai-gateway/`, `irmixy-*-orchestrator`) — natural seam between gateway and orchestrators; check for shallow wrappers.
- **Edge function shared utils** (`yyx-server/supabase/functions/_shared/`) — check for utility files that exist for one caller.
- **Frontend services** (`yyx-app/services/`) — check for services that are thin pass-throughs to Supabase calls.
- **Translation/locale handling** — multiple touch-points (`locale-utils.ts`, `LanguageContext`, `recipe_translations`); good candidate for depth analysis.
- **Meal-planner ranking** (`generate_plan`) — ensure the ranking core is deep behind a small interface.

### 2. Present candidates

Present a numbered list of deepening opportunities. For each candidate:

- **Files** — which files/modules are involved
- **Problem** — why the current architecture is causing friction
- **Solution** — plain English description of what would change
- **Benefits** — explained in terms of locality and leverage, and also how tests would improve

**Use CONTEXT.md vocabulary for the domain, and [LANGUAGE.md](LANGUAGE.md) vocabulary for the architecture.** If `CONTEXT.md` defines "Slot," talk about "the meal-plan slot module" — not "the FooBarHandler," and not "the slot service."

**ADR conflicts**: if a candidate contradicts an existing ADR in `docs/decisions/`, only surface it when the friction is real enough to warrant revisiting the ADR. Mark it clearly (e.g. _"contradicts `ai-model-selection.md` — but worth reopening because…"_). Don't list every theoretical refactor an ADR forbids.

Do NOT propose interfaces yet. Ask the user: "Which of these would you like to explore?"

### 3. Grilling loop

Once the user picks a candidate, drop into a grilling conversation. Walk the design tree with them — constraints, dependencies, the shape of the deepened module, what sits behind the seam, what tests survive.

Side effects happen inline as decisions crystallize:

- **Naming a deepened module after a concept not in `CONTEXT.md`?** Add the term to `CONTEXT.md`. Match the existing entry style — concept name in bold, one or two sentences.
- **Sharpening a fuzzy term during the conversation?** Update `CONTEXT.md` right there.
- **User rejects the candidate with a load-bearing reason?** Offer an ADR, framed as: _"Want me to record this as an ADR in `docs/decisions/` so future architecture reviews don't re-suggest it?"_ Only offer when the reason would actually be needed by a future explorer to avoid re-suggesting the same thing — skip ephemeral reasons ("not worth it right now") and self-evident ones. See [`docs/decisions/README.md`](../../../docs/decisions/README.md) for the format.
- **Want to explore alternative interfaces for the deepened module?** See [INTERFACE-DESIGN.md](INTERFACE-DESIGN.md).

### 4. Plan and hand off

Once a candidate is fully grilled, produce an implementation plan and hand it to the appropriate domain agent (`backend`, `frontend`, `ai-engineer`, `database`) for execution via the standard build/review cycle. Don't implement directly inside this skill — the skill is for *finding* and *shaping* deepening opportunities, not executing them.

For dependency strategy and testing approach when deepening, see [DEEPENING.md](DEEPENING.md).
