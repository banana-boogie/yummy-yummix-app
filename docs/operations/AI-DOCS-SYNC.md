# AI Docs Sync

Shared content blocks live once in `docs/agent-guidelines/shared/` and are injected into both `CLAUDE.md` (Claude Code) and `AGENTS.md` (Codex) via marker comments. This keeps platform instruction files in sync without manual duplication.

## How It Works

The `scripts/ai-docs-sync.js` script reads canonical markdown files from `docs/agent-guidelines/shared/` and replaces the content between marker comments in target files.

Markers look like:

```markdown
<!-- BEGIN:shared/project-overview -->
[content injected from docs/agent-guidelines/shared/project-overview.md]
<!-- END:shared/project-overview -->
```

Content **between** markers is managed by the script and will be overwritten on sync. Content **outside** markers is platform-specific and left untouched.

## Commands

```bash
npm run dev:docs-sync    # Update managed sections in CLAUDE.md and AGENTS.md
npm run dev:docs-check   # Verify managed sections match canonical sources (exit 1 on drift)
```

## Managed Blocks

| Block | Canonical Source | Description |
|-------|-----------------|-------------|
| `shared/project-overview` | `docs/agent-guidelines/shared/project-overview.md` | Project overview, target audience, repo structure |
| `shared/development-setup` | `docs/agent-guidelines/shared/development-setup.md` | Prerequisites, setup, workflow, commands, env vars, troubleshooting |
| `shared/architecture` | `docs/agent-guidelines/shared/architecture.md` | Tech stack, AI gateway, app structure, platform providers |
| `shared/conventions` | `docs/agent-guidelines/shared/conventions.md` | Imports, components, i18n, styling, layouts, services |
| `shared/testing` | `docs/agent-guidelines/shared/testing.md` | Testing requirements, patterns, commands, pre-commit hooks |
| `shared/git-conventions` | `docs/agent-guidelines/shared/git-conventions.md` | Branch naming, commit message format |
| `shared/analytics` | `docs/agent-guidelines/shared/analytics.md` | Analytics philosophy and event tracking |

## What's Canonical vs Platform-Specific

**Canonical (managed by sync):** Project knowledge that both platforms need — architecture, conventions, testing requirements, development setup.

**Platform-specific (manual, outside markers):**
- `CLAUDE.md`: Agent Team section (Claude Code agents/skills), AI Collaboration Prompts (plan mode)
- `AGENTS.md`: Core Principles (agent mindset), Code Quality Checklist, Common Test Patterns, File Locations, Troubleshooting

## Adding a New Managed Block

1. Create `docs/agent-guidelines/shared/my-block.md` with the canonical content
2. Add `'my-block'` to the `KNOWN_BLOCKS` array in `scripts/ai-docs-sync.js`
3. Add markers to the target files where the block should appear:
   ```markdown
   <!-- BEGIN:shared/my-block -->
   <!-- END:shared/my-block -->
   ```
4. Run `npm run dev:docs-sync`

## Editing Shared Content

1. Edit the canonical file in `docs/agent-guidelines/shared/`
2. Run `npm run dev:docs-sync` to propagate changes
3. Verify with `npm run dev:docs-check`

Never edit content between markers directly in `CLAUDE.md` or `AGENTS.md` — it will be overwritten on next sync.

## Troubleshooting

### "Unknown block" error
The block name in a marker doesn't match any file in `docs/agent-guidelines/shared/`. Either add the file or fix the marker name.

### "Duplicate BEGIN marker" error
A file has two `<!-- BEGIN:shared/X -->` markers for the same block. Each block should appear only once per file.

### "Found END without BEGIN" error
There's a closing marker without a matching opening marker. Check for typos in marker names.

### Drift detected in CI
Run `npm run dev:docs-sync` locally, review the changes, and commit.

## Related

- [AGENT-SYNC.md](./AGENT-SYNC.md) — Similar pattern for agent role files from `AGENT-ROLES.yaml`
- `scripts/agents-sync.js` — Agent role sync script (same architectural pattern)
