#!/usr/bin/env node

/**
 * agents-sync.js
 *
 * Generates platform-specific agent files from the canonical AGENT-ROLES.yaml.
 *
 * Usage:
 *   node scripts/agents-sync.js          # Generate .claude/agents/*.md + .codex/skills/<role-id>/*
 *   node scripts/agents-sync.js --check  # Verify generated files match committed files
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const YAML_PATH = path.join(ROOT, 'docs/agent-guidelines/AGENT-ROLES.yaml');
const CLAUDE_AGENTS_DIR = path.join(ROOT, '.claude/agents');
const CODEX_SKILLS_DIR = path.join(ROOT, '.codex/skills');
const GENERATED_HEADER =
  '<!-- Generated from docs/agent-guidelines/AGENT-ROLES.yaml — do not edit directly -->';

// ---------------------------------------------------------------------------
// Platform mapping — lives in the generator, not in the YAML
// ---------------------------------------------------------------------------

const CLAUDE_CONFIG = {
  model_map: { high: 'opus', standard: 'sonnet', fast: 'haiku' },
  tools_map: {
    execute: 'Read, Glob, Grep, Edit, Write, Bash',
    review: 'Read, Glob, Grep',
    strategy: 'Read, Glob, Grep',
  },
};

// Display names for the agent heading
const DISPLAY_NAMES = {
  'code-reviewer': 'Code Reviewer',
  backend: 'Backend Engineer',
  frontend: 'Frontend Engineer',
  designer: 'Designer',
  'ai-engineer': 'AI Engineer',
  database: 'Database Engineer',
  product: 'Product Strategist',
  'test-engineer': 'Test Engineer',
  docs: 'Documentation Engineer',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function titleCaseFromId(id) {
  return id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function truncateText(text, maxLength) {
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function firstSentence(text) {
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  const sentenceBoundary = normalized.indexOf('. ');
  if (sentenceBoundary === -1) return truncateText(normalized, 80);
  return normalized.slice(0, sentenceBoundary + 1);
}

function yamlQuoted(value) {
  return JSON.stringify(String(value));
}

function resolveCodexInterface(role) {
  const codex = role.codex || {};
  const displayName = codex.display_name || DISPLAY_NAMES[role.id] || titleCaseFromId(role.id);
  const shortDescription = codex.short_description || firstSentence(role.description);
  const displayNameLower = displayName.length > 0 ? displayName.toLowerCase() : role.id;
  const defaultPrompt =
    codex.default_prompt ||
    `Use $${role.name} for ${displayNameLower} tasks in the YummyYummix codebase.`;

  return {
    display_name: displayName,
    short_description: shortDescription,
    default_prompt: defaultPrompt,
  };
}

function checkFileDrift(filePath, expectedContent, relativePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`DRIFT: ${relativePath} does not exist`);
    return true;
  }

  const existing = fs.readFileSync(filePath, 'utf8');
  if (existing !== expectedContent) {
    console.error(`DRIFT: ${relativePath} differs from generated output`);
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function generateClaudeAgent(role) {
  const model = CLAUDE_CONFIG.model_map[role.model_tier] || 'opus';

  // Resolve tools: tool_overrides take precedence over mode default
  const tools = role.tool_overrides
    ? role.tool_overrides.join(', ')
    : CLAUDE_CONFIG.tools_map[role.mode] || 'Read, Glob, Grep';

  const displayName = DISPLAY_NAMES[role.id] || role.id;

  const lines = [GENERATED_HEADER, '---'];
  lines.push(`name: ${role.name}`);
  lines.push(`description: ${role.description}`);
  lines.push(`tools: ${tools}`);
  lines.push(`model: ${model}`);
  lines.push('---');
  lines.push('');
  lines.push(`# ${displayName} Agent`);
  lines.push('');
  lines.push(role.description);

  // References
  if (role.references && role.references.length > 0) {
    lines.push('');
    lines.push('## Before You Start');
    lines.push('');
    lines.push('Read these documents for context:');
    for (const ref of role.references) {
      lines.push(`- \`${ref}\``);
    }
  }

  // Rules
  if (role.rules && role.rules.length > 0) {
    lines.push('');
    lines.push('## Rules');
    lines.push('');
    for (const rule of role.rules) {
      lines.push(`- ${rule}`);
    }
  }

  // Output format (only code-reviewer has this)
  if (role.output_format) {
    lines.push('');
    lines.push('## Output Format');
    lines.push('');
    // Trim trailing newline from YAML block scalar
    lines.push(role.output_format.trimEnd());
  }

  lines.push('');
  return lines.join('\n');
}

function generateCodexSkill(role) {
  const displayName = DISPLAY_NAMES[role.id] || titleCaseFromId(role.id);
  const lines = ['---'];
  lines.push(`name: ${yamlQuoted(role.name)}`);
  lines.push(`description: ${yamlQuoted(role.description)}`);
  lines.push('---');
  lines.push('');
  lines.push(GENERATED_HEADER);
  lines.push('');
  lines.push(`# ${displayName}`);
  lines.push('');
  lines.push('## Overview');
  lines.push('');
  lines.push(role.description);

  if (role.references && role.references.length > 0) {
    lines.push('');
    lines.push('## References');
    lines.push('');
    for (const ref of role.references) {
      lines.push(`- \`${ref}\``);
    }
  }

  if (role.rules && role.rules.length > 0) {
    lines.push('');
    lines.push('## Rules');
    lines.push('');
    for (const rule of role.rules) {
      lines.push(`- ${rule}`);
    }
  }

  if (role.output_format) {
    lines.push('');
    lines.push('## Output Format');
    lines.push('');
    lines.push(role.output_format.trimEnd());
  }

  lines.push('');
  return lines.join('\n');
}

function generateCodexOpenAiYaml(role) {
  const interfaceConfig = resolveCodexInterface(role);
  return yaml.dump(
    {
      interface: {
        display_name: interfaceConfig.display_name,
        short_description: interfaceConfig.short_description,
        default_prompt: interfaceConfig.default_prompt,
      },
    },
    {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    }
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const checkMode = process.argv.includes('--check');

  // Read and parse YAML
  if (!fs.existsSync(YAML_PATH)) {
    console.error(`Error: YAML file not found at ${YAML_PATH}`);
    process.exit(1);
  }

  const yamlContent = fs.readFileSync(YAML_PATH, 'utf8');
  let config;
  try {
    config = yaml.load(yamlContent);
  } catch (e) {
    console.error(`Error parsing YAML: ${e.message}`);
    process.exit(1);
  }

  if (!config.roles || !Array.isArray(config.roles)) {
    console.error('Error: YAML must contain a "roles" array');
    process.exit(1);
  }

  // Ensure output directories exist (not in check mode)
  if (!checkMode) {
    fs.mkdirSync(CLAUDE_AGENTS_DIR, { recursive: true });
    fs.mkdirSync(CODEX_SKILLS_DIR, { recursive: true });
  }

  let driftFound = false;
  const generated = [];

  for (const role of config.roles) {
    const required = ['id', 'name', 'description', 'model_tier', 'mode'];
    const missing = required.filter((key) => !role[key]);
    if (missing.length > 0) {
      console.error(
        `Error: role "${role.id || '(unknown)'}" is missing required fields: ${missing.join(', ')}`
      );
      process.exit(1);
    }

    // Claude agent file
    const content = generateClaudeAgent(role);
    const filePath = path.join(CLAUDE_AGENTS_DIR, `${role.id}.md`);
    const relativePath = path.relative(ROOT, filePath);

    if (checkMode) {
      if (checkFileDrift(filePath, content, relativePath)) driftFound = true;
    } else {
      fs.writeFileSync(filePath, content, 'utf8');
      generated.push(relativePath);
    }

    // Codex role skill files
    const codexSkillContent = generateCodexSkill(role);
    const codexOpenAiContent = generateCodexOpenAiYaml(role);
    const codexSkillPath = path.join(CODEX_SKILLS_DIR, role.id, 'SKILL.md');
    const codexOpenAiPath = path.join(CODEX_SKILLS_DIR, role.id, 'agents/openai.yaml');
    const codexSkillRelative = path.relative(ROOT, codexSkillPath);
    const codexOpenAiRelative = path.relative(ROOT, codexOpenAiPath);

    if (checkMode) {
      if (checkFileDrift(codexSkillPath, codexSkillContent, codexSkillRelative)) driftFound = true;
      if (checkFileDrift(codexOpenAiPath, codexOpenAiContent, codexOpenAiRelative)) driftFound = true;
    } else {
      fs.mkdirSync(path.dirname(codexOpenAiPath), { recursive: true });
      fs.writeFileSync(codexSkillPath, codexSkillContent, 'utf8');
      fs.writeFileSync(codexOpenAiPath, codexOpenAiContent, 'utf8');
      generated.push(codexSkillRelative);
      generated.push(codexOpenAiRelative);
    }
  }

  if (checkMode) {
    // Also check for orphaned agent files not in YAML
    const yamlIds = new Set(config.roles.map((r) => r.id));
    if (fs.existsSync(CLAUDE_AGENTS_DIR)) {
      const existingFiles = fs.readdirSync(CLAUDE_AGENTS_DIR).filter((f) => f.endsWith('.md'));
      for (const file of existingFiles) {
        const id = file.replace(/\.md$/, '');
        if (!yamlIds.has(id)) {
          console.error(
            `DRIFT: .claude/agents/${file} exists but "${id}" is not defined in AGENT-ROLES.yaml`
          );
          driftFound = true;
        }
      }
    }

    // Orphaned generated Codex skills (manual skills are ignored)
    if (fs.existsSync(CODEX_SKILLS_DIR)) {
      const skillDirs = fs
        .readdirSync(CODEX_SKILLS_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory());

      for (const dir of skillDirs) {
        const id = dir.name;
        const skillFile = path.join(CODEX_SKILLS_DIR, id, 'SKILL.md');
        if (!fs.existsSync(skillFile)) continue;

        const skillContent = fs.readFileSync(skillFile, 'utf8');
        const isGenerated = skillContent.startsWith(GENERATED_HEADER);
        if (isGenerated && !yamlIds.has(id)) {
          console.error(
            `DRIFT: .codex/skills/${id}/SKILL.md is generated but "${id}" is not defined in AGENT-ROLES.yaml`
          );
          driftFound = true;
        }
      }
    }

    if (driftFound) {
      console.error('\nAgent files are out of sync. Run "npm run agents:sync" to regenerate.');
      process.exit(1);
    } else {
      console.log('All agent files are in sync with AGENT-ROLES.yaml.');
    }
  } else {
    console.log(`Generated ${generated.length} agent files:`);
    for (const f of generated) {
      console.log(`  ${f}`);
    }
  }
}

main();
