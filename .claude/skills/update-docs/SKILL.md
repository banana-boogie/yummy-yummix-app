---
name: yummyyummix:update-docs
description: Sync project documentation after feature changes by reading affected files and updating guideline docs, shared blocks, and running sync scripts.
disable-model-invocation: true
---

# Update Docs Skill

Sync project documentation after recent changes.

## Instructions

You are updating YummyYummix documentation to reflect recent codebase changes. Follow these steps exactly.

### Step 1: Determine Scope

Determine what changed based on `$ARGUMENTS` and recent git activity:

```bash
# If no arguments, check recent commits on current branch
git log --oneline --stat -10

# If argument is a commit range, PR number, or "all"
# Use appropriate git commands to identify changed files
```

Group changed files into domains:
- **Frontend** (`yyx-app/`) — May affect FRONTEND-GUIDELINES.md, DESIGN-GUIDELINES.md
- **Backend** (`yyx-server/supabase/functions/`) — May affect BACKEND-GUIDELINES.md, AI-GUIDELINES.md
- **Database** (`yyx-server/supabase/migrations/`) — May affect DATABASE-GUIDELINES.md
- **AI** (`_shared/ai-gateway/`, `_shared/tools/`, orchestrators) — May affect AI-GUIDELINES.md, CLAUDE-AI-ARCHITECTURE.md
- **Testing** (test files, test infrastructure) — May affect TESTING-GUIDELINES.md, TESTING.md
- **Config/Structure** (new directories, renamed files) — May affect CLAUDE.md shared blocks or manual sections
- **Shared blocks** (`docs/agent-guidelines/shared/`) — Content injected into CLAUDE.md and AGENTS.md via markers
- **Agent roles** (`docs/agent-guidelines/AGENT-ROLES.yaml`) — Generates `.claude/agents/*.md` and `.codex/skills/`

### Step 2: Read and Update Documentation

For each affected domain:

1. **Read the changed source files** to understand what was added, removed, or modified
2. **Read each affected guideline doc** in `docs/agent-guidelines/`:
   - `FRONTEND-GUIDELINES.md`, `BACKEND-GUIDELINES.md`, `AI-GUIDELINES.md`, `DATABASE-GUIDELINES.md`, `DESIGN-GUIDELINES.md`, `TESTING-GUIDELINES.md`, `PRODUCT-GUIDELINES.md`
3. **Read shared block files** in `docs/agent-guidelines/shared/` if architecture, conventions, testing, development setup, or other shared content changed
4. **Update each doc** as needed:
   - Verify file paths still exist (use Glob to spot-check)
   - Update descriptions that no longer match the code
   - Add new patterns, files, or conventions that were introduced
   - Remove references to deleted or renamed files
   - Check cross-doc consistency (e.g., if one doc references a section in another)

**Important — managed vs manual sections:**
- `CLAUDE.md` and `AGENTS.md` contain **managed blocks** between `<!-- BEGIN:shared/... -->` and `<!-- END:shared/... -->` markers. Never edit these directly — edit the canonical source in `docs/agent-guidelines/shared/` instead.
- Content **outside** managed blocks in `CLAUDE.md` (like the Agent Team section) can be edited directly.
- `yyx-server/CLAUDE.md` is not managed by sync — edit it directly.
- Agent files in `.claude/agents/` are **generated** from `AGENT-ROLES.yaml` — never edit them directly.

### Step 3: Run Sync Scripts

If any canonical sources were updated, run the appropriate sync commands:

1. **If shared block files changed** (`docs/agent-guidelines/shared/`):
   ```bash
   npm run dev:docs-sync
   ```
2. **If AGENT-ROLES.yaml changed** (`docs/agent-guidelines/AGENT-ROLES.yaml`):
   ```bash
   npm run dev:agents-sync
   ```
3. **Verify syncs succeeded**:
   ```bash
   npm run dev:docs-check
   npm run dev:agents-check
   ```

### Step 4: Verify Key Documents

After updating and syncing, verify these critical documents:

1. **`CLAUDE.md`** — Do the manual sections (Agent Team, AI Collaboration Prompts) still match? Are managed blocks up to date after sync?
2. **`yyx-server/CLAUDE.md`** — Does the edge function list and migration info still match?
3. **Agent guideline docs** — Do directory maps match actual directory structure?

Use Glob to spot-check that file paths referenced in updated docs actually exist.

### Step 5: Report

Output a summary:

```
## Documentation Update

### Files Updated
- `docs/agent-guidelines/BACKEND-GUIDELINES.md` — [what changed]
- `docs/agent-guidelines/shared/architecture.md` — [what changed]

### Syncs Run
- `dev:docs-sync` — [pass/fail]
- `dev:agents-sync` — [pass/fail]

### Files Verified (no changes needed)
- `docs/agent-guidelines/FRONTEND-GUIDELINES.md` — up to date

### Issues Found
- [Any stale references, broken paths, or inconsistencies that need manual attention]

### Recommended Follow-ups
- [Any docs that need deeper updates beyond what was done]
```
