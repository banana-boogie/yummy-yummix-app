#!/usr/bin/env node

/**
 * ai-docs-sync.js
 *
 * Syncs shared content blocks from docs/agent-guidelines/shared/ into
 * CLAUDE.md and AGENTS.md using marker comments.
 *
 * Markers look like:
 *   <!-- BEGIN:shared/block-name -->
 *   [content from canonical file]
 *   <!-- END:shared/block-name -->
 *
 * Content between markers is replaced on each sync. Content outside markers
 * is left untouched.
 *
 * Usage:
 *   node scripts/ai-docs-sync.js          # Sync shared blocks into target files
 *   node scripts/ai-docs-sync.js --check  # Verify targets match canonical blocks (exit 1 on drift)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SHARED_DIR = path.join(ROOT, 'docs/agent-guidelines/shared');

// Files that receive shared block injection
const TARGET_FILES = [
  path.join(ROOT, 'CLAUDE.md'),
  path.join(ROOT, 'AGENTS.md'),
];

// Known block keys (must match filenames in shared/ without .md extension)
const KNOWN_BLOCKS = [
  'project-overview',
  'development-setup',
  'architecture',
  'conventions',
  'testing',
  'git-conventions',
  'analytics',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readBlock(blockName) {
  const blockPath = path.join(SHARED_DIR, `${blockName}.md`);
  if (!fs.existsSync(blockPath)) {
    console.error(`Error: Canonical block not found: ${blockPath}`);
    process.exit(1);
  }
  return fs.readFileSync(blockPath, 'utf8');
}

function beginMarker(blockName) {
  return `<!-- BEGIN:shared/${blockName} -->`;
}

function endMarker(blockName) {
  return `<!-- END:shared/${blockName} -->`;
}

/**
 * Replace content between markers in a file's text.
 * Returns the updated text.
 */
function syncBlocks(fileText, filePath) {
  let result = fileText;
  const relativePath = path.relative(ROOT, filePath);

  // Find all markers present in this file
  const markerPattern = /<!-- BEGIN:shared\/([a-z-]+) -->/g;
  const foundBlocks = new Set();
  let match;

  while ((match = markerPattern.exec(fileText)) !== null) {
    const blockName = match[1];

    // Validate block name
    if (!KNOWN_BLOCKS.includes(blockName)) {
      console.error(
        `Error: Unknown block "shared/${blockName}" in ${relativePath}. ` +
          `Known blocks: ${KNOWN_BLOCKS.join(', ')}`
      );
      process.exit(1);
    }

    // Check for duplicate markers
    if (foundBlocks.has(blockName)) {
      console.error(`Error: Duplicate BEGIN marker for "shared/${blockName}" in ${relativePath}`);
      process.exit(1);
    }
    foundBlocks.add(blockName);
  }

  // Verify each found BEGIN has a matching END
  for (const blockName of foundBlocks) {
    const begin = beginMarker(blockName);
    const end = endMarker(blockName);

    const beginIdx = result.indexOf(begin);
    const endIdx = result.indexOf(end);

    if (endIdx === -1) {
      console.error(
        `Error: Found BEGIN but no END marker for "shared/${blockName}" in ${relativePath}`
      );
      process.exit(1);
    }

    if (endIdx < beginIdx) {
      console.error(
        `Error: END marker appears before BEGIN for "shared/${blockName}" in ${relativePath}`
      );
      process.exit(1);
    }

    // Check for duplicate END markers
    const secondEnd = result.indexOf(end, endIdx + end.length);
    if (secondEnd !== -1) {
      console.error(`Error: Duplicate END marker for "shared/${blockName}" in ${relativePath}`);
      process.exit(1);
    }

    // Replace content between markers
    const blockContent = readBlock(blockName);
    const before = result.slice(0, beginIdx + begin.length);
    const after = result.slice(endIdx);
    result = before + '\n' + blockContent + '\n' + after;
  }

  // Check for orphaned END markers
  const endPattern = /<!-- END:shared\/([a-z-]+) -->/g;
  while ((match = endPattern.exec(result)) !== null) {
    const blockName = match[1];
    if (!foundBlocks.has(blockName)) {
      console.error(`Error: Found END marker without BEGIN for "shared/${blockName}" in ${relativePath}`);
      process.exit(1);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const checkMode = process.argv.includes('--check');

  // Verify shared directory exists
  if (!fs.existsSync(SHARED_DIR)) {
    console.error(`Error: Shared blocks directory not found: ${SHARED_DIR}`);
    process.exit(1);
  }

  // Verify all known blocks exist
  for (const blockName of KNOWN_BLOCKS) {
    const blockPath = path.join(SHARED_DIR, `${blockName}.md`);
    if (!fs.existsSync(blockPath)) {
      console.error(`Error: Missing canonical block: ${blockPath}`);
      process.exit(1);
    }
  }

  let driftFound = false;

  for (const targetPath of TARGET_FILES) {
    const relativePath = path.relative(ROOT, targetPath);

    if (!fs.existsSync(targetPath)) {
      console.error(`Error: Target file not found: ${relativePath}`);
      process.exit(1);
    }

    const original = fs.readFileSync(targetPath, 'utf8');
    const synced = syncBlocks(original, targetPath);

    if (checkMode) {
      if (original !== synced) {
        console.error(`DRIFT: ${relativePath} has managed blocks out of sync with canonical sources`);
        driftFound = true;
      }
    } else {
      if (original !== synced) {
        fs.writeFileSync(targetPath, synced, 'utf8');
        console.log(`  Updated: ${relativePath}`);
      } else {
        console.log(`  Up to date: ${relativePath}`);
      }
    }
  }

  if (checkMode) {
    if (driftFound) {
      console.error('\nManaged blocks are out of sync. Run "npm run ai-docs:sync" to update.');
      process.exit(1);
    } else {
      console.log('All managed blocks are in sync with canonical sources.');
    }
  } else {
    console.log('\nSync complete.');
  }
}

main();
