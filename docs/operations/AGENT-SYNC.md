# Agent Roles Sync

Single source of truth for agent role definitions across Claude Code and Codex.

## How It Works

```
AGENT-ROLES.yaml  →  agents-sync.js  →  .claude/agents/*.md
  (canonical)          (generator)    →  .codex/skills/<role-id>/{SKILL.md,agents/openai.yaml}
```

1. **`docs/agent-guidelines/AGENT-ROLES.yaml`** defines all agent roles: id, description, model tier, mode, references, rules
2. **`scripts/agents-sync.js`** reads the YAML and generates platform-specific artifacts for Claude and Codex role skills
3. **`npm run agents:check`** compares generated output against committed files — fails on drift

## File Map

| File | Type | Edit? |
|------|------|-------|
| `docs/agent-guidelines/AGENT-ROLES.yaml` | Canonical source | Yes — this is where you edit roles |
| `scripts/agents-sync.js` | Generator | Only to change templates or add platforms |
| `.claude/agents/*.md` | Generated | No — run `agents:sync` instead |
| `.codex/skills/<role-id>/SKILL.md` | Generated (role skills) | No — run `agents:sync` instead |
| `.codex/skills/<role-id>/agents/openai.yaml` | Generated (role skill UI metadata) | No — run `agents:sync` instead |
| `docs/agent-guidelines/*.md` | Hand-authored guidelines | Yes — these are platform-agnostic playbooks |
| `.claude/skills/*.md` | Hand-authored skills | Yes — not managed by sync |
| `.codex/skills/review-pr/*` | Hand-authored skill | Yes — excluded from role sync |
| `.codex/skills/review-changes/*` | Hand-authored skill | Yes — excluded from role sync |

## Commands

```bash
npm run agents:sync    # Generate Claude agent files and Codex role skills from YAML
npm run agents:check   # Verify generated files match committed (CI-safe)
```

## How to Add a New Agent

1. Add a new role entry to `docs/agent-guidelines/AGENT-ROLES.yaml`
2. Optionally create a guideline doc in `docs/agent-guidelines/` and reference it
3. Run `npm run agents:sync`
4. Commit the YAML, generated Claude + Codex role files, and any new guideline docs

## How to Modify an Agent

1. Edit the role in `docs/agent-guidelines/AGENT-ROLES.yaml` (never edit generated files directly)
2. Run `npm run agents:sync`
3. Commit the YAML and regenerated Claude + Codex role files

## How to Remove an Agent

1. Remove the role from `docs/agent-guidelines/AGENT-ROLES.yaml`
2. Run `npm run agents:sync`
3. Delete orphaned generated files:
   - `.claude/agents/<id>.md`
   - `.codex/skills/<id>/`
4. `npm run agents:check` will flag leftover generated files (manual Codex skills are ignored)
5. Commit

## How to Add a New Guideline Doc

1. Create the doc in `docs/agent-guidelines/` (e.g., `NEW-DOMAIN-GUIDELINES.md`)
2. Add the path to the role's `references` array in `AGENT-ROLES.yaml`
3. Run `npm run agents:sync`
4. Commit

## YAML Schema

```yaml
version: "1"

roles:
  - id: my-agent              # Kebab-case ID, becomes filename
    name: "yummyyummix:my-agent"  # Full agent name
    description: "..."         # One-line description
    model_tier: high           # high → opus, standard → sonnet, fast → haiku
    mode: execute              # execute → full tools, review/strategy → read-only
    tool_overrides:            # Optional: override mode's default tools
      - Read
      - Glob
      - Grep
    references:                # Guideline docs to read
      - docs/agent-guidelines/MY-GUIDELINES.md
    rules:                     # Bullet-point rules for the agent
      - "Do this"
      - "Never do that"
    output_format: |           # Optional: specific output format instructions
      Format description here
    codex:                     # Optional: Codex UI metadata overrides
      display_name: "My Agent"
      short_description: "One-line chip label text"
      default_prompt: "Use $yummyyummix:my-agent to ..."
```

## CI Integration

Add to your CI pipeline:

```bash
npm run agents:check
```

Exits 0 if all agent files match YAML. Exits 1 and lists drifted files if not.

## Troubleshooting

**"DRIFT: file differs from generated output"**
You edited a generated agent file directly. Run `npm run agents:sync` to regenerate from YAML.

**"DRIFT: file exists but id is not defined in AGENT-ROLES.yaml"**
An agent file exists that isn't in the YAML. Either add it to YAML or delete the orphaned file.

**"DRIFT: .codex/skills/<id>/SKILL.md is generated but id is not defined..."**
A generated Codex role skill was left after role removal. Delete `.codex/skills/<id>/` or re-add the role to YAML.

**YAML parse error**
Check YAML syntax. Common issues: missing quotes around strings with colons, incorrect indentation. Use `node -e "require('js-yaml').load(require('fs').readFileSync('docs/agent-guidelines/AGENT-ROLES.yaml','utf8'))"` to test parsing.

## Codex Notes

- Role-derived Codex skills are generated under `.codex/skills/<role-id>/`.
- Existing workflow skills such as `.codex/skills/review-pr/` and `.codex/skills/review-changes/` remain hand-authored and are intentionally not managed by this generator.
