---
name: yummyyummix:build-feature
description: Guided full-stack feature development with product thinking, domain exploration, architecture design, and implementation using YummyYummix guideline docs for domain expertise.
argument-hint: Feature description
disable-model-invocation: true
---

# Build Feature Skill

You are helping a developer build a new feature for YummyYummix. Follow a systematic 7-phase approach, using the project's guideline docs for domain expertise in each phase.

## Core Principles

- **Ask clarifying questions** — Identify ambiguities and ask before assuming. Wait for answers.
- **Understand before acting** — Read and comprehend existing patterns first.
- **Use guideline docs** — Read the relevant `docs/agent-guidelines/*.md` files for domain expertise before working in each area.
- **Product thinking first** — Think about what's worth building before how to build it.
- **Use TodoWrite** — Track progress through all phases.

---

## Phase 1: Discovery & Product Thinking

**Goal**: Understand what needs to be built and whether it's the right thing.

Initial request: $ARGUMENTS

**Actions**:
1. Create todo list with all 7 phases
2. Read `docs/agent-guidelines/PRODUCT-GUIDELINES.md` for product strategy context
3. **Tip:** Consider asking the `product` agent for feature brainstorming and MVP scoping before diving in.
4. Analyze the feature as a product strategist:
   - What problem does this solve for Thermomix owners?
   - What's the highest-value slice (MVP)?
   - What user stories does this serve?
   - What are the risks and open questions?
5. If the feature is unclear, ask the user for clarification:
   - What problem are they solving?
   - What should the feature do?
   - Any constraints or requirements?
6. Summarize understanding and confirm with user

---

## Phase 2: Domain Exploration

**Goal**: Understand relevant existing code and patterns deeply.

**Actions**:
1. Determine which domains are affected (frontend, backend, AI, database)
2. Read the relevant guideline docs for each affected domain:
   - **Frontend** → `docs/agent-guidelines/FRONTEND-GUIDELINES.md`
   - **Backend** → `docs/agent-guidelines/BACKEND-GUIDELINES.md`
   - **AI** → `docs/agent-guidelines/AI-GUIDELINES.md`
   - **Database** → `docs/agent-guidelines/DATABASE-GUIDELINES.md`
3. **Tip:** For deep domain exploration, consider asking the relevant domain agent (`frontend`, `backend`, `ai-engineer`, `database`) to investigate.
4. Explore each affected domain using Glob, Grep, and Read:
   - **Frontend** — Find existing patterns similar to the feature. List key files in `yyx-app/`.
   - **Backend** — Find edge function patterns relevant to the feature. List key files in `yyx-server/`.
   - **AI** — Find AI system integration points. List key files in `_shared/ai-gateway/`, `_shared/tools/`.
   - **Database** — Find current schema relevant to the feature. List key tables/migrations.
5. Read all key files identified to build deep understanding
6. Present comprehensive summary of findings

---

## Phase 3: Clarifying Questions

**Goal**: Fill in all gaps and resolve ambiguities before designing.

**CRITICAL**: Do NOT skip this phase.

**Actions**:
1. Review product thinking (Phase 1) + domain exploration (Phase 2)
2. Identify underspecified aspects:
   - Edge cases, error handling
   - Integration points with existing features
   - Scope boundaries (what's in/out)
   - Design preferences (if UI is involved)
   - Backward compatibility concerns
   - Performance requirements
3. **Present all questions in a clear, organized list**
4. **Wait for answers before proceeding**

If the user says "whatever you think is best", provide your recommendation and get explicit confirmation.

---

## Phase 4: Architecture & Design

**Goal**: Design the implementation approach.

**Tip:** Consider asking domain agents for architecture input: `designer` for UI/UX specs, `frontend` for component architecture, `backend` for edge function design, `database` for schema design, `ai-engineer` for AI system integration.

**Actions**:
1. If UI is involved, read `docs/agent-guidelines/DESIGN-GUIDELINES.md` and produce a design spec:
   - Component hierarchy, NativeWind classes, layout composition
   - Visual rationale and accessibility notes
   - States: loading, empty, error, success

2. Design the technical architecture:
   - Database schema changes (if any)
   - Backend API/edge function design
   - AI system integration (if any)
   - Frontend component and service design
   - Data flow from backend to UI

3. Present to user:
   - Design spec (if UI)
   - Technical architecture
   - Implementation sequence (what gets built first)
   - **Your recommendation with reasoning**

4. **Ask user to approve before implementation**

---

## Phase 5: Implementation

**Goal**: Build the feature.

**DO NOT START WITHOUT USER APPROVAL from Phase 4.**

**Actions**:
Build in dependency order. Write tests for each domain as you go.
Refer to `docs/agent-guidelines/shared/testing.md` for testing requirements and patterns.

1. **Database** (if needed) — Write migration files following the migration workflow:
   - `npm run backup` → `npm run migration:new <name>` → edit SQL → `npm run db:push`
   - Include RLS policies for every new table

2. **Backend** (if needed) — Build edge functions, shared utilities, API endpoints:
   - Follow edge function template pattern
   - Add Zod validation
   - Write Deno tests

3. **AI** (if needed) — Build AI features following gateway and tool registry patterns:
   - Register new tools in tool-registry.ts
   - Add validators and shape functions
   - Write Deno tests

4. **Frontend** — Build screens, components, services, hooks:
   - Follow component creation checklist
   - Use design tokens, common components
   - Add i18n keys to both en and es
   - Write Jest tests

5. Update todos as you progress

---

## Phase 6: Quality Review

**Goal**: Ensure code quality before considering the feature done.

**Actions**:
1. Read `docs/agent-guidelines/REVIEW-CRITERIA.md` for review standards
2. Review all changed files against:
   - Architecture & design fit
   - Correctness (bugs, edge cases)
   - Dead code & cleanup
   - Performance issues
   - Project conventions
   - Test coverage
3. **Present findings to user and ask what they want to do** (fix now, fix later, proceed as-is)
4. Address issues based on user decision

---

## Phase 7: Summary & Documentation

**Goal**: Document what was accomplished and keep project docs in sync.

**Actions**:
1. Mark all todos complete
2. Summarize:
   - **What was built** — Feature description and how it works
   - **Key decisions** — Design choices and trade-offs made
   - **Files modified** — Complete list of created/changed files
   - **Tests written** — What was tested
   - **Suggested next steps** — Phase 2 ideas, manual testing to do

3. Update documentation:
   - Check each affected guideline doc in `docs/agent-guidelines/` for stale references
   - If shared content changed (architecture, conventions, testing, etc.), edit the canonical source in `docs/agent-guidelines/shared/` — not CLAUDE.md or AGENTS.md directly
   - Run `npm run dev:docs-sync` to propagate shared block changes
   - If agent roles changed, update `docs/agent-guidelines/AGENT-ROLES.yaml` and run `npm run dev:agents-sync`
   - Verify file paths referenced in docs still exist
   - Add new patterns/files that were introduced
4. **Tip:** Consider running the `/update-docs` skill to sync documentation.
