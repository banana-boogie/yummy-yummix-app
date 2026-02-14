---
name: yummyyummix:build-feature
description: Guided full-stack feature development with product thinking, domain exploration, architecture design, and implementation using specialized YummyYummix agents.
argument-hint: Feature description
disable-model-invocation: true
---

# Build Feature Skill

You are helping a developer build a new feature for YummyYummix. Follow a systematic 7-phase approach using specialized domain agents. This skill is modeled after the `feature-dev` plugin workflow but uses YummyYummix-specific agents.

## Core Principles

- **Ask clarifying questions** — Identify ambiguities and ask before assuming. Wait for answers.
- **Understand before acting** — Read and comprehend existing patterns first.
- **Read files identified by agents** — When agents return key file lists, read those files yourself.
- **Product thinking first** — Think about what's worth building before how to build it.
- **Use TodoWrite** — Track progress through all phases.

---

## Phase 1: Discovery & Product Thinking

**Goal**: Understand what needs to be built and whether it's the right thing.

Initial request: $ARGUMENTS

**Actions**:
1. Create todo list with all 7 phases
2. Launch the **yummyyummix:product** agent (via Task tool with `subagent_type: "yummyyummix:product"`) to analyze the feature:
   - What problem does this solve for Thermomix owners?
   - What's the highest-value slice (MVP)?
   - What user stories does this serve?
   - What are the risks and open questions?
3. Review the product agent's output
4. If the feature is unclear, ask the user for clarification:
   - What problem are they solving?
   - What should the feature do?
   - Any constraints or requirements?
5. Summarize understanding and confirm with user

---

## Phase 2: Domain Exploration

**Goal**: Understand relevant existing code and patterns deeply.

**Actions**:
1. Determine which domains are affected (frontend, backend, AI, database)
2. Launch domain-specific agents in parallel as explorers. For each relevant domain, use the appropriate agent:
   - **Frontend** → `yummyyummix:frontend` — "Explore existing patterns similar to [feature]. List key files."
   - **Backend** → `yummyyummix:backend` — "Explore edge function patterns relevant to [feature]. List key files."
   - **AI** → `yummyyummix:ai-engineer` — "Explore AI system integration points for [feature]. List key files."
   - **Database** → `yummyyummix:database` — "Explore current schema relevant to [feature]. List key tables/migrations."

   Each agent should return a list of 5-10 key files to read.

3. Read all files identified by the agents to build deep understanding
4. Present comprehensive summary of findings

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

**Actions**:
1. If UI is involved, launch **yummyyummix:designer** (via Task tool with `subagent_type: "yummyyummix:designer"`) to produce a design spec:
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
Build in dependency order. Each domain agent writes tests for its code.

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
1. Launch **yummyyummix:code-reviewer** (via Task tool with `subagent_type: "yummyyummix:code-reviewer"`) to review all changed files against:
   - Architecture & design fit
   - Correctness (bugs, edge cases)
   - Dead code & cleanup
   - Performance issues
   - Project conventions

2. Review the findings yourself
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

3. Launch **yummyyummix:docs** (via Task tool with `subagent_type: "yummyyummix:docs"`) to update documentation:
   - Pass the list of all created/changed files and a summary of what changed
   - The docs agent will update affected guideline docs, CLAUDE.md, architecture docs, and verify file paths
   - Review the docs agent's changes and include them in the summary
