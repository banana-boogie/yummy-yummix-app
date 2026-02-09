# Claude Code Productivity Workflow

A reference guide for maximizing productivity with Claude Code on the YummyYummix project — covering general best practices, cloud execution, and strategies for parallelizing work.

**See also:** [CLAUDE.md](./CLAUDE.md) (project conventions), [TESTING.md](./TESTING.md) (testing patterns), [AGENT.md](./AGENT.md) (AI agent guidelines)

---

## Table of Contents

- [General Productivity Tips](#general-productivity-tips)
- [Teleport & Cloud Execution](#teleport--cloud-execution)
- [Parallel Work Strategies](#parallel-work-strategies)
- [YummyYummix Parallelization Guide](#yummyyummix-parallelization-guide)
- [Sub-Agents & Agent Teams](#sub-agents--agent-teams)
- [Environment Configuration](#environment-configuration)
- [Quick Reference Checklist](#quick-reference-checklist)

---

## General Productivity Tips

### Give Claude Verification Criteria

The more concrete your success criteria, the better the result. Tell Claude how to verify its own work:

```
Add a "Save to Favorites" button to the recipe detail screen.
Verify: run `npm test` in yyx-app/ — all tests should pass.
The button should use <Button variant="primary"> from @/components/common.
```

Good verification criteria include:
- **Tests to run** — `npm run test:ci`, `deno task test`
- **Expected behavior** — "the function should return an array of Recipe objects"
- **Constraints** — "use existing design tokens, don't add new colors"

### Use Plan Mode for Complex Tasks

Plan Mode lets Claude analyze the codebase and create a detailed plan before writing any code. This prevents wasted effort on the wrong approach.

```bash
claude --permission-mode plan
```

Or press **Shift+Tab** during a session to cycle into plan mode.

Claude will read files, trace dependencies, and propose a structured plan. Review it, adjust, then let Claude execute — or send the plan to the cloud (see [Teleport & Cloud Execution](#teleport--cloud-execution)).

### Manage Your Context Window

Long conversations degrade quality. Use these commands to stay sharp:

| Command | What It Does |
|---------|-------------|
| `/compact` | Summarizes conversation history, freeing context space |
| `/compact focus on auth logic` | Summarizes but preserves detail on a specific topic |
| `/clear` | Wipes conversation history entirely (cannot be undone) |
| `/cost` | Shows token usage and cost for the current session |

**Rule of thumb:** If a session has been running for a while and responses feel less focused, run `/compact` before continuing.

### Configure Permissions to Reduce Interruptions

Every approval prompt breaks your flow. Use `/permissions` to pre-approve safe, frequent actions:

```
/permissions
```

Common rules to allow:
- **Read** tools (always safe)
- **Edit/Write** within project directories
- **Bash**: `npm test`, `npm run lint`, `deno task test`

You can also set a default permission mode at startup:

```bash
claude --permission-mode plan       # Research only, no writes
claude --permission-mode auto-edit  # Auto-approve file edits
```

### Use /rewind for Safe Experimentation

Made a wrong turn? `/rewind` rolls back to a previous point in the conversation:

```
/rewind
```

This lets you experiment freely — try an approach, and if it doesn't work, rewind and try another without starting a fresh session.

### Session Management

Sessions persist automatically. Name them early for easy retrieval:

```
/rename recipe-search-overhaul
```

Later, resume by name:

```bash
claude --continue                        # Most recent session in this directory
claude --resume recipe-search-overhaul   # Resume by name
claude --resume                          # Interactive session picker
```

**Session picker shortcuts:**

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate sessions |
| `Enter` | Select session |
| `P` | Preview content |
| `R` | Rename session |
| `/` | Search/filter |
| `B` | Filter to current git branch |

---

## Teleport & Cloud Execution

Teleport lets you offload work to cloud-hosted Claude Code sessions, freeing your terminal for other tasks.

### Sending Work to the Cloud

**Prefix any message with `&`** to send it to a cloud session:

```
& Refactor recipeService.ts to use pagination with cursor-based fetching
```

Or start a cloud session directly from the command line:

```bash
claude --remote "Add unit tests for the MeasurementContext"
```

Each `&` message creates an independent cloud session. You can send multiple tasks:

```
& Fix the flaky auth timeout test
& Add Spanish translations for the new settings screen
& Write edge function unit tests for ai-chat
```

All three run simultaneously. Monitor them with:

```
/tasks
```

### How Cloud Execution Works

1. Your repository is cloned onto an Anthropic-managed VM
2. Claude sets up the environment and analyzes your code
3. Changes are made, tests are run, work is verified
4. Results are pushed to a branch, ready for review

The cloud environment comes pre-loaded with Node.js, Deno, Python, and common dev tools — everything YummyYummix needs.

### Bringing Work Back with /teleport

When a cloud session finishes, bring its changes into your local terminal:

```
/teleport
```

Or use the shorthand:

```
/tp
```

This opens an interactive picker of your cloud sessions. Select one and Claude fetches the branch and applies the changes locally.

You can also teleport directly:

```bash
claude --teleport                  # Interactive picker
claude --teleport <session-id>     # Resume specific session
```

Or from `/tasks`, press `t` to teleport into a session.

### Requirements for Teleporting

| Requirement | Details |
|-------------|---------|
| **Clean working directory** | No uncommitted changes (you'll be prompted to stash if needed) |
| **Same repository** | Must be in a checkout of the same repo, not a fork |
| **Branch pushed to remote** | The cloud session's branch must be available on the remote |
| **Same account** | Must be authenticated to the same Claude.ai account |

### Pro Pattern: Plan Locally, Execute Remotely

Use plan mode to research and design, then hand off execution to the cloud:

```bash
# 1. Start in plan mode
claude --permission-mode plan

# 2. Research and plan
> I need to add real-time recipe collaboration. Analyze the codebase and create a plan.

# 3. Once the plan looks good, send to cloud for execution
& Execute the collaboration feature plan we just created

# 4. Continue working on something else locally while cloud runs
```

---

## Parallel Work Strategies

### Git Worktrees — Local Isolation

Git worktrees let you check out multiple branches into separate directories, sharing Git history but with completely isolated file state. Each worktree can run its own Claude Code session.

**Setup:**

```bash
# From the main repo directory
git worktree add ../yummyix-feature-a -b feature/new-ingredient-search
git worktree add ../yummyix-bugfix -b fix/auth-session-timeout
```

**Run Claude in each:**

```bash
# Terminal 1
cd ../yummyix-feature-a
claude

# Terminal 2
cd ../yummyix-bugfix
claude
```

**Clean up when done:**

```bash
git worktree list                              # See all worktrees
git worktree remove ../yummyix-feature-a       # Remove finished worktree
```

**Why worktrees over branches?**
- Each worktree has its own working directory — Claude instances can't interfere with each other
- No need to stash/switch — each task has a stable file state
- All worktrees share remotes, so pushing and merging works normally

### Cloud Sessions — Multiple Tasks in Parallel

Send multiple independent tasks to the cloud simultaneously:

```
& Add skeleton loading states to the recipe list screen
& Write integration tests for the parse-recipe-markdown edge function
& Migrate the UserProfile context to use React Query
```

Each runs in its own isolated VM. Monitor with `/tasks`, teleport results back as they finish.

### Agent Teams — Coordinated Automation

For larger efforts where tasks depend on each other, agent teams let multiple Claude sessions coordinate through shared task assignment and direct messaging. See [Sub-Agents & Agent Teams](#sub-agents--agent-teams) for full details on setup and usage.

---

## YummyYummix Parallelization Guide

The YummyYummix project has natural isolation boundaries that make it easy to parallelize work safely.

### Isolation Boundaries

| Domain | Paths | Safe to Parallelize? |
|--------|-------|---------------------|
| **Frontend features** | `yyx-app/components/`, `yyx-app/app/` | ✅ Yes — screens and components are modular |
| **Edge Functions** | `yyx-server/supabase/functions/` | ✅ Yes — each function is self-contained |
| **Database migrations** | `yyx-server/supabase/migrations/` | ⚠️ Caution — migrations are ordered; coordinate timing |
| **Frontend tests** | `yyx-app/` (Jest) | ✅ Yes — tests are independent |
| **Backend tests** | `yyx-server/` (Deno) | ✅ Yes — tests are independent |
| **i18n translations** | `yyx-app/i18n/index.ts` | ⚠️ Caution — single file; merge conflicts likely |
| **Design tokens** | `yyx-app/constants/design-tokens.js` | ⚠️ Caution — single file; coordinate changes |
| **Services** | `yyx-app/services/` | ✅ Yes — services are generally independent |
| **Contexts** | `yyx-app/contexts/` | ✅ Yes — each context is its own file |

### Example: Parallel Full-Stack Feature

**Goal:** Add a "Meal Planner" feature with a new screen, edge function, and database table.

**Step 1 — Plan locally:**

```bash
claude --permission-mode plan
> Plan a Meal Planner feature: users can save recipes to a weekly calendar.
> It needs a new DB table, an edge function for CRUD, and a new tab screen.
```

**Step 2 — Execute in parallel:**

```
& Create the meal_plans migration and apply it:
  - Table: meal_plans (id, user_id, recipe_id, planned_date, meal_type)
  - Add RLS policies for user isolation

& Build the meal-planner edge function in yyx-server/supabase/functions/:
  - CRUD endpoints for meal plans
  - Include Deno unit tests

& Create the MealPlanner screen and components in yyx-app/:
  - New tab in app/(tabs)/meal-planner.tsx
  - WeekView component showing 7 days
  - Use existing RecipeCard component for display
  - Add i18n strings for both en and es
```

**Step 3 — Integrate:**

As each cloud session finishes, teleport the results back and resolve any integration points (e.g., wiring the frontend service to the edge function endpoint).

### What Parallelizes Well

✅ **Do parallelize:**
- Independent UI screens/components
- Separate edge functions
- Tests for different subsystems (frontend vs backend)
- Service files that don't share state
- Documentation updates

⚠️ **Coordinate carefully:**
- Changes that touch `i18n/index.ts` (single file, merge conflicts)
- Database migrations (must be ordered correctly)
- Shared utilities in `yyx-server/supabase/functions/_shared/`
- Changes to `design-tokens.js` or global styles

---

## Sub-Agents & Agent Teams

Claude Code can delegate work to specialized agents that run in their own context window. There are two mechanisms: **sub-agents** (stable) and **agent teams** (experimental).

### Sub-Agents

Sub-agents are specialized AI assistants defined as markdown files in `.claude/agents/`. Claude automatically delegates to them based on their description. Each runs in its own isolated context with its own tools and permissions.

**Creating a sub-agent:**

Create a markdown file in `.claude/agents/` with YAML frontmatter:

```markdown
---
name: code-reviewer
description: Expert code reviewer. Use proactively after code changes.
tools: Read, Glob, Grep, Bash
model: sonnet
---

You are a senior code reviewer for the YummyYummix project.
Review code for quality, security, and adherence to project conventions in CLAUDE.md.

Focus on:
- Correct use of design tokens (no hardcoded colors/spacing)
- All user-facing strings use i18n (both en and es)
- Components use <Text> from @/components/common, never React Native's Text
- NativeWind className patterns match project conventions
```

**Frontmatter fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier |
| `description` | Yes | When Claude should delegate to this agent |
| `tools` | No | Allowed tools (e.g., `Read, Glob, Grep, Bash`) |
| `disallowedTools` | No | Tools to deny |
| `model` | No | `sonnet`, `opus`, `haiku`, or inherit from parent |
| `permissionMode` | No | `default`, `acceptEdits`, `plan`, etc. |
| `memory` | No | `user`, `project`, or `local` — enables persistent learning |

**Where sub-agents live (highest priority first):**

1. `--agents` CLI flag (session-only)
2. `.claude/agents/` (project-level, commit to git)
3. `~/.claude/agents/` (user-level, all projects)

**YummyYummix sub-agent ideas:**

| Agent | Purpose | Model |
|-------|---------|-------|
| `code-reviewer` | Review code for project conventions, i18n, design tokens | sonnet |
| `test-writer` | Write tests following patterns in TESTING.md | sonnet |
| `i18n-checker` | Verify all strings are translated in both en and es | haiku |
| `edge-function-dev` | Develop and test Deno edge functions | sonnet |

**Example: `i18n-checker` agent**

```markdown
---
name: i18n-checker
description: Checks that all user-facing strings use i18n and have translations in both English and Spanish. Use after UI changes.
tools: Read, Glob, Grep
model: haiku
---

You check i18n compliance for the YummyYummix app.

Rules:
1. No hardcoded user-facing strings in components — use i18n.t()
2. Every key in i18n/index.ts must have both `en` and `es` translations
3. Import i18n from '@/i18n'
4. Report any missing translations or hardcoded strings
```

**Persistent memory:**

Sub-agents with `memory` enabled learn across sessions. Memory is stored in:
- `user` → `~/.claude/agent-memory/<agent-name>/`
- `project` → `.claude/agent-memory/<agent-name>/`
- `local` → `.claude/agent-memory-local/<agent-name>/`

This lets an agent like `code-reviewer` remember patterns it's seen before and improve its feedback over time.

### Agent Teams (Experimental)

Agent teams enable multiple independent Claude Code sessions to work together in parallel with **direct inter-agent communication**. Each teammate is a full Claude Code instance with its own context window.

#### Setup

Enable the feature (disabled by default):

```json
// .claude/settings.json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Or in your shell: `export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

#### Starting a Team

There's no special CLI flag — describe what you want in natural language:

```
Create an agent team to build the Meal Planner feature:
- One teammate for the database migration and RLS policies
- One teammate for the edge function CRUD endpoints
- One teammate for the React Native screen and components

Each teammate should own their files completely — no overlap.
```

Claude breaks the work into tasks, spawns teammates, and assigns them. You can also specify models per teammate:

```
Create an agent team with:
- One architect teammate (Opus) to design the API contract
- Two implementation teammates (Sonnet) for frontend and backend
- One test writer (Haiku) for unit tests
```

#### Navigating Between Teammates

**In-process mode** (default) — all teammates run in your terminal:

| Key | Action |
|-----|--------|
| `Shift+Up` / `Shift+Down` | Select a teammate |
| Type normally | Message the selected teammate |
| `Shift+Tab` | Toggle delegate mode on the lead |

**Split-pane mode** — each teammate gets its own tmux or iTerm2 pane:

```bash
claude --teammate-mode tmux        # Force split panes
claude --teammate-mode in-process  # Force single terminal
```

Split panes require tmux or iTerm2 with the `it2` CLI. Not supported in VS Code integrated terminal.

#### How Communication Works

- **Direct messaging**: any teammate can message any other teammate
- **Broadcast**: send to all teammates at once (use sparingly — costs scale)
- **Automatic notifications**: the lead is notified when teammates finish
- **Shared task list**: tasks have dependencies that auto-unblock when completed

#### Delegate Mode

Press **Shift+Tab** to put the lead into delegate mode — it can only coordinate (spawn, message, assign tasks), not write code itself. This prevents the lead from implementing when it should be orchestrating.

Use delegate mode when:
- The task is large enough that the lead should focus on breaking down work
- You want pure orchestration without the lead touching code
- Teammates need clear ownership of their files

#### Avoiding File Conflicts

The biggest gotcha with agent teams: **two teammates editing the same file will overwrite each other**. Break work so each teammate owns different files:

```
✅ Good — clear file ownership:
  Teammate A → yyx-app/components/MealPlanner/
  Teammate B → yyx-server/supabase/functions/meal-planner/
  Teammate C → yyx-app/__tests__/MealPlanner/

❌ Bad — shared file conflict:
  Teammate A → edits i18n/index.ts
  Teammate B → also edits i18n/index.ts
```

For shared files like `i18n/index.ts`, have one teammate own all i18n changes, or have teammates coordinate via messages before editing.

#### Cost and Limitations

**Token cost scales linearly** — 3 teammates ≈ 3x token usage. Agent teams are most cost-effective for:
- Parallel exploration / research from different angles
- Competing debugging hypotheses
- Independent module development
- Code review from multiple perspectives

They're overkill for routine sequential tasks — use a single session or sub-agents instead.

**Other limitations:**
- Sessions can't be resumed with teammates (`/resume` and `/rewind` don't restore teammate state)
- One team per session — clean up before starting another
- Teammates can't spawn nested teams
- Teammates load CLAUDE.md, rules, and MCP servers, but **not your conversation history** — include enough context in the spawn prompt

#### YummyYummix Examples

**Parallel code review:**

```
Create an agent team to review the recipe search PR:
- One teammate checking for security issues (RLS, input validation)
- One teammate checking performance (query efficiency, pagination)
- One teammate validating test coverage

Have them discuss findings and consolidate a final report.
```

**Competing debug hypotheses:**

```
Users are getting stale recipe data after editing. Spawn 3 teammates:
- One investigating caching issues in the service layer
- One checking Supabase realtime subscription setup
- One looking at React state management in RecipeContext

Have them share findings and disprove each other's theories.
```

**Full-stack feature development:**

```
Build the ingredient substitution feature with a team:
- "backend": create the edge function in yyx-server/supabase/functions/ingredient-subs/
- "frontend": build the SubstitutionCard component in yyx-app/components/
- "ai": implement the AI prompt logic in _shared/ai-gateway.ts

Backend should message frontend when the API contract is ready.
```

#### Sub-Agents vs. Agent Teams

| | Sub-Agents | Agent Teams |
|---|---|---|
| **Status** | Stable | Experimental |
| **Activation** | Automatic (based on description) | Prompt-based (you ask for a team) |
| **Communication** | Report back to parent only | Direct inter-agent messaging |
| **Coordination** | Parent manages everything | Shared task list, self-coordination |
| **Context** | Doesn't get conversation history | Doesn't get conversation history |
| **Token cost** | Lower | Higher (scales with team size) |
| **Session resume** | N/A | Not supported with teammates |
| **Best for** | Focused isolated tasks | Large parallel efforts needing discussion |

**When to use which:**
- **Sub-agents**: code review, i18n checks, test writing, focused analysis — anything a single agent can handle independently
- **Agent teams**: full-stack features spanning multiple layers, large refactors, debugging with competing hypotheses, multi-perspective code review

---

## Environment Configuration

Setting up your `.claude/` directory properly reduces friction and makes Claude more effective on every session.

### Directory Structure

```
.claude/
├── settings.json          # Project-level config (commit to git)
├── settings.local.json    # Personal overrides (.gitignore this)
├── agents/                # Sub-agent definitions
│   ├── code-reviewer.md
│   ├── test-writer.md
│   └── i18n-checker.md
├── skills/                # Reusable prompts and workflows
│   └── fix-issue/
│       └── SKILL.md
├── rules/                 # Modular CLAUDE.md extensions
│   ├── security.md
│   └── frontend/
│       └── react-patterns.md
└── .mcp.json              # MCP server configuration
```

### Settings: Reduce Permission Interruptions

The biggest productivity drain is approving the same safe commands over and over. Pre-allow them in `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Read",
      "Bash(npm test *)",
      "Bash(npm run lint *)",
      "Bash(npm run test:ci)",
      "Bash(deno task *)",
      "Bash(supabase status)",
      "Bash(supabase db reset)",
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git log *)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(git push --force *)"
    ]
  }
}
```

For personal preferences that shouldn't be committed, use `.claude/settings.local.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(supabase functions serve *)",
      "Bash(supabase functions deploy *)"
    ]
  },
  "env": {
    "EXPO_PUBLIC_SUPABASE_URL": "http://192.168.1.222:54321"
  }
}
```

### Hooks: Automated Quality Checks

Hooks run scripts automatically when Claude uses tools. They're deterministic — they fire every time with zero exceptions.

**Hook events:**

| Event | When It Fires |
|-------|--------------|
| `SessionStart` | Session begins |
| `PreToolUse` | Before Claude uses any tool |
| `PostToolUse` | After a tool completes successfully |
| `PostToolUseFailure` | After a tool fails |
| `UserPromptSubmit` | When you submit a prompt |
| `PreCompact` | Before context compaction |
| `SubagentStart` | When a sub-agent starts |
| `SubagentStop` | When a sub-agent completes |
| `Stop` | Session ends |

**Example: Auto-lint after file edits**

```json
// .claude/settings.json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "cd yyx-app && npx eslint --fix $CLAUDE_FILE_PATH 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

**Example: Block dangerous bash commands**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "./scripts/validate-command.sh"
          }
        ]
      }
    ]
  }
}
```

Hook scripts receive JSON on stdin with tool details. Exit codes:
- `0` — allow the operation
- `2` — block the operation (Claude sees the error message)

### Rules: Modular Instructions

Instead of packing everything into CLAUDE.md, split domain-specific instructions into `.claude/rules/`:

```
.claude/rules/
├── security.md          # RLS policies, auth patterns
├── frontend/
│   └── react-patterns.md  # Component conventions, NativeWind usage
└── edge-functions.md    # Deno patterns, shared utilities
```

These files are automatically loaded alongside CLAUDE.md, keeping each file focused and maintainable.

### Skills: Reusable Workflows

Skills are prompts that Claude loads on demand — either automatically (based on description) or manually (as slash commands).

**Example: `/fix-issue` slash command**

Create `.claude/skills/fix-issue/SKILL.md`:

```markdown
---
name: fix-issue
description: Fix a GitHub issue end-to-end
disable-model-invocation: true
---

## Fix GitHub Issue

Analyze and fix GitHub issue $ARGUMENTS.

1. Run `gh issue view $ARGUMENTS` to get issue details
2. Understand the problem and search the codebase for relevant files
3. Implement the fix following conventions in CLAUDE.md
4. Write or update tests
5. Verify: `npm run test:ci` (frontend) or `deno task test` (backend)
6. Create a descriptive commit with conventional commit format
```

Then invoke with: `/fix-issue 42`

### MCP Servers: External Tool Integration

MCP connects Claude to external tools. Configure in `.claude/.mcp.json`:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["@supabase/mcp-server"],
      "env": {
        "SUPABASE_URL": "${SUPABASE_URL}",
        "SUPABASE_API_KEY": "${SUPABASE_API_KEY}"
      }
    }
  }
}
```

The Supabase MCP server gives Claude direct access to run queries, manage migrations, and inspect your database — already enabled for this project.

### Environment Variables

Set project-level environment variables in settings:

```json
// .claude/settings.json
{
  "env": {
    "NODE_ENV": "development",
    "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "80"
  }
}
```

Notable variables:
- `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` — trigger compaction earlier (default: 95%)
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` — enable agent teams
- `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` — disable background task execution

---

## Quick Reference Checklist

### Before Starting Work

- [ ] Name your session: `/rename descriptive-name`
- [ ] Use plan mode for complex tasks: `Shift+Tab` or `--permission-mode plan`
- [ ] Set up permissions for common commands: `/permissions`
- [ ] Check that `.claude/settings.json` has your common commands pre-allowed

### During Work

- [ ] Give concrete verification criteria (tests, expected output)
- [ ] Run `/compact` when the conversation gets long
- [ ] Use `/rewind` to backtrack instead of starting over
- [ ] Send independent tasks to the cloud with `&` prefix
- [ ] Monitor cloud tasks with `/tasks`
- [ ] Let sub-agents handle focused tasks (code review, i18n checks)

### For Parallel Work

- [ ] Use git worktrees for local parallel sessions
- [ ] Use `&` prefix for cloud parallel sessions
- [ ] Keep parallel tasks in separate isolation boundaries (see table above)
- [ ] Avoid parallel edits to single shared files (`i18n/index.ts`, `design-tokens.js`)
- [ ] Consider agent teams for large full-stack features

### Environment Setup (One-Time)

- [ ] Create `.claude/settings.json` with permission allowlists
- [ ] Add `.claude/settings.local.json` to `.gitignore`
- [ ] Define sub-agents in `.claude/agents/` for repeated tasks (review, testing, i18n)
- [ ] Set up hooks for auto-linting after file edits
- [ ] Create skills for common workflows (`/fix-issue`, etc.)
- [ ] Split domain rules into `.claude/rules/` to keep CLAUDE.md concise

### Wrapping Up

- [ ] Check `/cost` to track usage
- [ ] Teleport cloud results back: `/tp`
- [ ] Run full test suites before merging: `npm run test:ci` and `deno task test`
- [ ] Clean up worktrees: `git worktree remove ../path`
