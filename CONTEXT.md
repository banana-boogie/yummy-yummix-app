# CONTEXT.md — YummyYummix Ubiquitous Language

> A shared glossary for humans and AI agents working on YummyYummix. The goal is **concision**: one canonical name per concept, so conversations and code stay aligned.
>
> **When to update this file:** any time a new domain term enters the codebase, or you find yourself explaining a term twice. If a term is in the code but not here, add it. If two terms describe the same thing, pick one and retire the other.

---

## People & Personas

- **Irmixy** — The AI cooking companion (in-app brand). All AI-powered chat, voice, and recipe-generation features speak as Irmixy.
- **Sofía** — Persona: Mexican Thermomix owner, 35–50, tech-comfortable, runs the household's weekly food decisions. **The buyer** — paying user (149 MXN/mo), acute weekly-planning pain, dogfood match for the founder.
- **Lupita** — Persona: experienced home cook, 55+, tech-anxious. **The design constraint, not the buyer** — included as a 3–5-person accessibility/usability cohort in beta.
- **Sell to Sofía, Design for Lupita** — Strategy rule. Surfaces are sold on Sofía's planning pain; every UI must still pass the **Lupita gate** (44px+ targets, plain Spanish, no self-discovery, large readable text).
- **Two Gates** — Every UI decision answers (1) **Sofía gate** — does the buyer pay more / retain longer / refer more? and (2) **Lupita gate** — can the constraint user complete it without help? Both must pass.

## Product Loop

- **Discovery → Plan → Cook → Feedback** — The four-stage product loop. New features must connect to at least one stage; ideally they bridge two.
- **Mexico-First** — Launch market. Primary language is Spanish (`es`); English (`en`) ships alongside but is secondary.

## Recipes & Cooking

- **Recipe** — A cookable artifact with ingredients, steps, metadata, and Thermomix parameters.
- **Thermomix Step** — A cooking step with `thermomixTime`, `thermomixTemp`, and `thermomixSpeed`. Generated and validated against Thermomix-valid ranges.
- **Thermomix-First** — Design rule: every recipe and recipe-generation prompt assumes a Thermomix is in the kitchen. Manual/stovetop instructions are secondary.
- **Recipe Generation** vs **Recipe Modification** — Two distinct AI usage types. Generation creates a new recipe from a brief; modification transforms an existing recipe JSON (e.g. swap ingredient, scale portions).
- **Portions** — Servings the recipe yields. Distinct from *meal-plan portions* (see below).
- **Recipe Review Snapshot** — A local-first JSON export of review-critical recipe state (rows, translations, ingredients, steps, links, tools, pairings, tags) under `yyx-server/data-pipeline/data/recipe-review-snapshots/`. Produced by `pipeline:export-review-snapshot`, consumed by `/review-recipe` to avoid per-recipe Supabase round-trips. Review input only — `apply-recipe-metadata` always reads live Supabase, gated by the YAML's stale-diff guard.

## Meal Planning

- **Meal Plan** — A user's plan over a date range, composed of meal-plan slots.
- **Slot** — A single (date, meal-type) cell in a meal plan, optionally filled with a recipe.
- **generate_plan** — Edge Function entry point that ranks recipes for a user and fills slots. See `docs/MEAL-PLANNER-SCORING.md`.

## Localization

- **Locale** — A user-facing language code, e.g. `en`, `es`, `es-MX`.
- **Base Locale** — `en` and `es` only. These hold the canonical translation row for each entity. `en` is US English, `es` is Mexican Spanish.
- **Regional Override** — A locale row like `es-MX` or `es-ES` that **only** overrides specific fields differing from the base. Never store base content under a regional code.
- **Locale Chain** — Within-family fallback list, e.g. `es-MX → es`. Built by `buildLocaleChain()` in `_shared/locale-utils.ts`. Resolved server-side via `pickTranslation()` or the `resolve_locale()` RPC.
- **No Cross-Language Fallback** — A Spanish user must never fall back to English content, and vice versa. `en` and `es` are separate user groups.
- **UI Strings** vs **Entity Translations** — UI strings live in `i18n/index.ts` (i18n-js). Entity translations (recipe names, steps, tips) live in `*_translations` tables.

## AI Architecture

- **AI Gateway** — `yyx-server/supabase/functions/_shared/ai-gateway/`. The single entry point for all AI calls. Direct provider SDK calls are forbidden.
- **Usage Type** — A semantic label for an AI call (`text`, `recipe_generation`, `recipe_modification`, `parsing`, `embedding`, `nutrition`, `translation`). Each usage type maps to a default model + provider, overridable by env var.
- **Lingua Franca** — The gateway's interface uses OpenAI's request/response format. Each provider translator in `providers/<name>.ts` converts to/from this format. The gateway is **not** OpenAI-specific.
- **Orchestrator** — An Edge Function that combines tool calling, streaming, and the gateway to drive a multi-turn AI flow. Examples: `irmixy-chat-orchestrator`, `irmixy-voice-orchestrator`.
- **Tool** — A callable function the orchestrator can invoke during a turn. Defined in the AI tool system, not a generic JS function.
- **RAG** — Retrieval-augmented generation. Vector search over recipe embeddings (3072-dim, `text-embedding-3-large`) to ground AI responses.

## Frontend

- **Design Tokens** — Single source of truth for color, spacing, typography, and radius. Lives in `constants/design-tokens.js` and is consumed via NativeWind classes (`bg-primary-default`, `p-md`, `rounded-lg`).
- **Preset** — A named typography style on the `Text` component (`h1`, `body`, `handwritten`, etc.). Never use `font-size` or React Native's `<Text>` directly.
- **PageLayout** / **ResponsiveLayout** — The two layout primitives every screen wraps with. PageLayout owns header/footer; ResponsiveLayout owns max-width.
- **Platform-Specific Provider** — A `.web.ts` / `.ts` file pair where Metro auto-selects per platform. Used for native-only features like WebRTC voice.

## Database & Backend

- **RLS** — Row-level security. Every user-facing table has policies; service-role bypasses them.
- **RPC** — A PostgreSQL function callable from the client via `supabase.rpc()`. Examples: `resolve_locale`, `generate_plan`.
- **Migration** — A timestamped SQL file in `yyx-server/supabase/migrations/`. Always run `npm run backup` before `npm run db:push`.
- **Edge Function** — A Deno/TypeScript serverless function in `yyx-server/supabase/functions/`. Each lives in its own folder with `index.ts`.
- **Shared Util** — A module under `_shared/` reused across edge functions (CORS, auth, AI gateway, locale utils). Never import across function folders directly.

## Operations

- **Backup-Before-Migrate** — Mandatory rule: `npm run backup:all` before any `db:push`. No exceptions.
- **MCP-Secret Rule** — Never fetch service-role keys, API keys, or passwords through MCP tools. Read them from the Supabase dashboard directly.
- **Dev Login** — A dev-only quick-login button on the login screen, gated by `__DEV__` and the `EXPO_PUBLIC_DEV_LOGIN_*` env vars.

## Workflow

- **Feature Branch + PR** — All work goes through a PR against `main`. Never push to main directly.
- **Worktree** — A sibling directory at `../<branch-name>` containing an isolated checkout of a feature branch. Used for parallel work.
- **Build Cycle** — The 7-phase feature workflow: Design → Approval → Implementation → Cross-Review → Testing → Documentation → PR. See CLAUDE.md "Development Workflow".
- **Cross-Review** — One AI implements, a second AI reviews, Claude triages with `/triage-review` to merge the best findings.

## Documentation

- **Guideline Doc** — A domain playbook in `docs/agent-guidelines/*.md` (FRONTEND-GUIDELINES, AI-GUIDELINES, etc.). The source agents and skills consult.
- **Shared Block** — A canonical fragment in `docs/agent-guidelines/shared/*.md` injected into CLAUDE.md and AGENTS.md by `scripts/ai-docs-sync.js`. Never edit the injected copy.
- **ADR** — Architecture Decision Record. A short markdown file in `docs/decisions/` capturing one non-obvious decision and its reasoning. See `docs/decisions/README.md`.
