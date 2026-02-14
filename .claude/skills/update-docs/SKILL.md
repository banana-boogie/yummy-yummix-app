---
name: yummyyummix:update-docs
description: Sync project documentation after feature changes. Delegates to the docs agent to update architecture docs, CLAUDE.md, agent guidelines, and verify accuracy.
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
- **Config/Structure** (new directories, renamed files) — May affect CLAUDE.md

### Step 2: Delegate to Docs Agent

Use the **yummyyummix:docs** sub-agent (via the Task tool with `subagent_type: "yummyyummix:docs"`) with a detailed prompt that includes:

1. The list of changed files and their domains
2. A summary of what changed (new features, renamed files, new patterns, removed code)
3. Instructions to:
   - Read each affected guideline doc
   - Verify file paths still exist
   - Update descriptions that no longer match the code
   - Add new patterns/files that were introduced
   - Remove references to deleted or renamed files
   - Check cross-doc consistency

### Step 3: Verify Key Documents

After the docs agent completes, verify these critical documents yourself:

1. **`CLAUDE.md`** — Does the project overview, architecture section, and conventions still match?
2. **`yyx-server/CLAUDE.md`** — Does the edge function list and migration info still match?
3. **Agent guideline docs** — Do directory maps match actual directory structure?

Use Glob to spot-check that file paths referenced in updated docs actually exist.

### Step 4: Report

Output a summary:

```
## Documentation Update

### Files Updated
- `docs/agent-guidelines/BACKEND-GUIDELINES.md` — [what changed]
- `CLAUDE.md` — [what changed]

### Files Verified (no changes needed)
- `docs/agent-guidelines/FRONTEND-GUIDELINES.md` — up to date

### Issues Found
- [Any stale references, broken paths, or inconsistencies that need manual attention]

### Recommended Follow-ups
- [Any docs that need deeper updates beyond what was done]
```
