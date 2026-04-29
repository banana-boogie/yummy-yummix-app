#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env
/**
 * Apply Recipe Metadata YAML
 *
 * Reads YAML configs from data-pipeline/data/recipe-metadata/<slug>.yaml,
 * computes a diff against the current DB state, and (in --apply mode) calls
 * the apply_recipe_metadata RPC to perform the change in a single transaction.
 *
 * Usage:
 *   deno task pipeline:apply-recipe-metadata --local --dry-run
 *   deno task pipeline:apply-recipe-metadata --local --recipe mongolian-beef --dry-run
 *   deno task pipeline:apply-recipe-metadata --local --all --apply
 *
 * Flags:
 *   --local / --production   Target environment (required)
 *   --dry-run                Print diff, write nothing (default if --apply absent)
 *   --apply                  Call apply_recipe_metadata RPC (mutating)
 *   --recipe <slug>          Apply a single YAML by filename (without .yaml)
 *   --file <path>            Apply a specific YAML file by absolute or relative path
 *   --all                    Apply every YAML in data/recipe-metadata/
 *   --verbose                Print no-op sections too
 *   --list-missing           Print recipes with no YAML yet (added in task 8)
 *   --list-authoring         Print YAMLs with non-empty requires_authoring (task 8)
 *   --list-applied           Print YAMLs that have been applied (have an applied: entry)
 *   --list-unapplied         Print YAMLs that have not been applied yet (no applied: entry)
 */

import { createPipelineConfig, hasFlag, parseEnvironment, parseFlag } from '../lib/config.ts';
import { Logger } from '../lib/logger.ts';
import {
  parseRecipeMetadataYaml,
  RecipeMetadataValidationError,
} from '../lib/recipe-metadata-schema.ts';
import { fetchCurrentRecipeState } from '../lib/recipe-metadata-fetch.ts';
import {
  computeRecipeMetadataDiff,
  formatDiffForCli,
  formatRecipeSnapshot,
  formatRequiresAuthoring,
} from '../lib/recipe-metadata-diff.ts';
import {
  applyRecipeMetadata,
  StaleDiffError,
  summariseCounts,
} from '../lib/recipe-metadata-apply.ts';
import {
  appendAppliedEntry,
  readAppliedEntries,
  resolveAppliedBy,
  sectionsFromCounts,
} from '../lib/recipe-metadata-applied-log.ts';

const logger = new Logger('apply-recipe-metadata');

const DATA_DIR = new URL('../data/recipe-metadata/', import.meta.url).pathname;

interface CliOptions {
  env: 'local' | 'production';
  dryRun: boolean;
  apply: boolean;
  files: string[];
  verbose: boolean;
}

function parseOptions(args: string[]): CliOptions {
  const env = parseEnvironment(args);
  const apply = hasFlag(args, '--apply');
  const dryRun = hasFlag(args, '--dry-run') || !apply;
  const verbose = hasFlag(args, '--verbose');

  const recipe = parseFlag(args, '--recipe');
  const file = parseFlag(args, '--file');
  const all = hasFlag(args, '--all');

  const files: string[] = [];
  if (file) files.push(resolvePath(file));
  if (recipe) files.push(`${DATA_DIR}${recipe}.yaml`);
  if (all) {
    for (const entry of Deno.readDirSync(DATA_DIR)) {
      if (entry.isFile && entry.name.endsWith('.yaml')) files.push(`${DATA_DIR}${entry.name}`);
    }
  }
  if (files.length === 0) {
    logger.error('Specify --recipe <slug>, --file <path>, or --all');
    Deno.exit(1);
  }

  return { env, dryRun, apply, files, verbose };
}

// ============================================================
// --list-missing / --list-authoring (pre-apply worklists)
// ============================================================

interface ScanReportRecipe {
  recipeId: string;
  recipeName: string;
}

interface QualityReportIssue {
  recipeId: string;
  recipeName: string;
  category: string;
  detail: string;
}

interface QualityReport {
  issues: QualityReportIssue[];
}

function loadJsonReport<T>(filename: string): T | null {
  const path = new URL(`../${filename}`, import.meta.url).pathname;
  try {
    return JSON.parse(Deno.readTextFileSync(path)) as T;
  } catch {
    return null;
  }
}

function listExistingYamlSlugs(): Map<string, string> {
  const slugs = new Map<string, string>();
  for (const entry of Deno.readDirSync(DATA_DIR)) {
    if (!entry.isFile || !entry.name.endsWith('.yaml')) continue;
    slugs.set(entry.name.replace(/\.yaml$/, ''), `${DATA_DIR}${entry.name}`);
  }
  return slugs;
}

function nameToSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function commandListMissing(): number {
  const quality = loadJsonReport<QualityReport>('quality-report.json');
  const scanRaw = loadJsonReport<{ recipes?: ScanReportRecipe[] }>('scan-report.json');
  if (!quality && !scanRaw) {
    logger.error(
      'No scan-report.json or quality-report.json found in data-pipeline/. ' +
        'Run `deno task pipeline:scan` first.',
    );
    return 1;
  }

  const yamls = listExistingYamlSlugs();
  const yamlIdsKnownToBeMissingFromYaml: Map<string, { name: string; reasons: string[] }> =
    new Map();

  // Recipes flagged in the quality report don't yet have YAML coverage if
  // their slugified name is not in the YAML directory.
  for (const issue of quality?.issues ?? []) {
    const slug = nameToSlug(issue.recipeName);
    if (yamls.has(slug)) continue;
    const entry = yamlIdsKnownToBeMissingFromYaml.get(issue.recipeId) ?? {
      name: issue.recipeName,
      reasons: [],
    };
    if (!entry.reasons.includes(issue.category)) entry.reasons.push(issue.category);
    yamlIdsKnownToBeMissingFromYaml.set(issue.recipeId, entry);
  }

  // scan-report.json shape varies — best-effort include any names it lists.
  const scanned = (scanRaw && Array.isArray((scanRaw as Record<string, unknown>).recipes))
    ? ((scanRaw as Record<string, unknown>).recipes as ScanReportRecipe[])
    : [];
  for (const r of scanned) {
    const slug = nameToSlug(r.recipeName);
    if (yamls.has(slug)) continue;
    if (yamlIdsKnownToBeMissingFromYaml.has(r.recipeId)) continue;
    yamlIdsKnownToBeMissingFromYaml.set(r.recipeId, { name: r.recipeName, reasons: ['scan'] });
  }

  if (yamlIdsKnownToBeMissingFromYaml.size === 0) {
    logger.info('No recipes missing YAML coverage. Every flagged recipe has a YAML file.');
    return 0;
  }

  logger.section('Recipes missing YAML coverage');
  for (const [id, entry] of yamlIdsKnownToBeMissingFromYaml) {
    logger.info(`  ${entry.name}  (${id})  reasons: ${entry.reasons.join(', ')}`);
  }
  logger.info('');
  logger.info(`Run /review-recipe <name> to start one of these.`);
  return 0;
}

function commandListAuthoring(): number {
  const yamls = listExistingYamlSlugs();
  const flagged: Array<{ slug: string; reasons: string[]; notes: string }> = [];

  for (const [slug, path] of yamls) {
    let yamlText: string;
    try {
      yamlText = Deno.readTextFileSync(path);
    } catch {
      continue;
    }
    let parsed;
    try {
      parsed = parseRecipeMetadataYaml(yamlText);
    } catch (e) {
      logger.warn(
        `  ${slug}.yaml — schema invalid (skipping in scan): ${String(e).split('\n')[0]}`,
      );
      continue;
    }
    const ra = parsed.data.requires_authoring;
    if (ra && ra.reasons.length > 0) {
      flagged.push({ slug, reasons: ra.reasons, notes: ra.notes ?? '' });
    }
  }

  if (flagged.length === 0) {
    logger.info(
      'No YAMLs with non-empty requires_authoring. All committed recipes are reviewer-clean.',
    );
    return 0;
  }

  logger.section('Recipes flagged requires_authoring (not publishable until human-authored)');
  for (const f of flagged) {
    logger.info(`  ${f.slug}.yaml  reasons: ${f.reasons.join(', ')}`);
    if (f.notes) logger.info(`    note: ${f.notes}`);
  }
  return 0;
}

function resolvePath(input: string): string {
  if (input.startsWith('/')) return input;
  return `${Deno.cwd()}/${input}`;
}

async function fetchRecipeUpdatedAt(
  supabase: ReturnType<typeof createPipelineConfig>['supabase'],
  recipeId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('recipes')
    .select('updated_at')
    .eq('id', recipeId)
    .maybeSingle();
  if (error) throw new Error(`fetch post-apply updated_at: ${error.message}`);
  if (!data) throw new Error(`recipe ${recipeId} disappeared after apply`);
  return (data as { updated_at: string }).updated_at;
}

// ============================================================
// --list-applied / --list-unapplied (apply-state worklists)
// ============================================================

function commandListApplied(): number {
  const yamls = listExistingYamlSlugs();
  const applied: Array<{ slug: string; entryCount: number; lastAppliedAt: string }> = [];

  for (const [slug, path] of yamls) {
    let yamlText: string;
    try {
      yamlText = Deno.readTextFileSync(path);
    } catch {
      continue;
    }
    const entries = readAppliedEntries(yamlText);
    if (!entries || entries.length === 0) continue;
    const last = entries[entries.length - 1];
    applied.push({
      slug,
      entryCount: entries.length,
      lastAppliedAt: last.applied_at,
    });
  }

  if (applied.length === 0) {
    logger.info('No YAMLs have an applied: entry yet.');
    return 0;
  }

  applied.sort((a, b) => a.lastAppliedAt.localeCompare(b.lastAppliedAt));

  logger.section(`YAMLs with applied: entries (${applied.length})`);
  for (const a of applied) {
    const suffix = a.entryCount > 1 ? `  (${a.entryCount} applies)` : '';
    logger.info(`  ${a.slug}.yaml  last: ${a.lastAppliedAt}${suffix}`);
  }
  return 0;
}

function commandListUnapplied(): number {
  const yamls = listExistingYamlSlugs();
  const unapplied: string[] = [];

  for (const [slug, path] of yamls) {
    let yamlText: string;
    try {
      yamlText = Deno.readTextFileSync(path);
    } catch {
      continue;
    }
    const entries = readAppliedEntries(yamlText);
    if (entries === null || entries.length === 0) {
      unapplied.push(slug);
    }
  }

  if (unapplied.length === 0) {
    logger.info('Every YAML has at least one applied: entry.');
    return 0;
  }

  logger.section(`YAMLs without an applied: entry (${unapplied.length})`);
  for (const slug of unapplied.sort()) {
    logger.info(`  ${slug}.yaml`);
  }
  logger.info('');
  logger.info(
    `Run \`deno task pipeline:apply-recipe-metadata --local --recipe <slug> --apply\` ` +
      `to apply one. The CLI will append the applied: entry on success.`,
  );
  return 0;
}

interface ProcessOutcome {
  file: string;
  ok: boolean;
  totalChanges: number;
  message?: string;
}

async function processFile(
  filePath: string,
  config: ReturnType<typeof createPipelineConfig>,
  opts: CliOptions,
): Promise<ProcessOutcome> {
  let yamlText: string;
  try {
    yamlText = Deno.readTextFileSync(filePath);
  } catch (e) {
    return { file: filePath, ok: false, totalChanges: 0, message: `read failed: ${e}` };
  }

  let parsed;
  try {
    parsed = parseRecipeMetadataYaml(yamlText);
  } catch (e) {
    if (e instanceof RecipeMetadataValidationError) {
      logger.error(`${filePath} — schema validation failed:`);
      for (const issue of e.issues) {
        const loc = issue.line !== undefined
          ? `${filePath}:${issue.line}:${issue.col ?? 1}`
          : filePath;
        logger.error(`  ${loc} — ${issue.path ? issue.path + ' — ' : ''}${issue.message}`);
      }
      return { file: filePath, ok: false, totalChanges: 0, message: 'schema validation failed' };
    }
    return { file: filePath, ok: false, totalChanges: 0, message: String(e) };
  }
  for (const w of parsed.warnings) {
    logger.warn(`${filePath}:${w.line ?? '?'} — ${w.message}`);
  }

  let current;
  try {
    current = await fetchCurrentRecipeState(config.supabase, parsed.data.recipe_match.id);
  } catch (e) {
    return {
      file: filePath,
      ok: false,
      totalChanges: 0,
      message: `fetch current state: ${e}`,
    };
  }

  if (
    current.name_en &&
    current.name_en.trim().toLowerCase() !==
      parsed.data.recipe_match.name_en.trim().toLowerCase()
  ) {
    return {
      file: filePath,
      ok: false,
      totalChanges: 0,
      message:
        `recipe_match.name_en mismatch — yaml="${parsed.data.recipe_match.name_en}" db="${current.name_en}". ` +
        `The YAML may be pointing at the wrong recipe.`,
    };
  }

  const diff = computeRecipeMetadataDiff(parsed.data, current);

  const fileName = filePath.split('/').pop() ?? '';
  const divider = '─'.repeat(72);
  console.log('');
  console.log(divider);
  console.log(`  ${fileName}`);
  console.log(divider);
  console.log('');
  console.log(formatRecipeSnapshot(current));
  console.log('');
  console.log(divider);
  console.log('');
  console.log(formatDiffForCli(diff, opts.verbose));
  const ra = formatRequiresAuthoring(parsed.data.requires_authoring);
  if (ra) {
    console.log('');
    console.log(divider);
    console.log('');
    console.log(ra);
  }
  console.log('');

  if (diff.stale_diff) {
    return {
      file: filePath,
      ok: false,
      totalChanges: diff.total_changes,
      message: 'stale_diff — re-run /review-recipe',
    };
  }

  if (opts.apply) {
    if (diff.total_changes === 0) {
      logger.info(`  apply: no-op (idempotent) — applied log unchanged`);
      return { file: filePath, ok: true, totalChanges: 0 };
    }
    try {
      const result = await applyRecipeMetadata(config.supabase, parsed.data);
      logger.info(`  apply: ok=${result.ok} changed=${result.changed}`);
      logger.info(summariseCounts(result.counts));
      if (result.errors.length > 0) {
        for (const e of result.errors) logger.warn(`  ${e}`);
      }

      // Append an `applied:` entry on success when changes actually landed.
      // Skip on no-op: the RPC may report changed=false in edge cases (e.g.
      // every diff section was already idempotent at the row level).
      // Transactional note: the DB commit has already succeeded by this point
      // — if the YAML write fails we log loudly so the reviewer can recover
      // (re-running --apply will be a no-op and won't double-record).
      if (
        result.ok &&
        result.changed &&
        result.errors.length === 0
      ) {
        try {
          const postUpdatedAt = await fetchRecipeUpdatedAt(
            config.supabase,
            parsed.data.recipe_match.id,
          );
          const entry = {
            applied_at: new Date().toISOString(),
            applied_by: resolveAppliedBy(opts.env),
            pre_recipe_updated_at: parsed.data.recipe_match.expected_recipe_updated_at,
            post_recipe_updated_at: postUpdatedAt,
            sections_changed: sectionsFromCounts(result.counts),
            environment: opts.env,
          };
          const updated = appendAppliedEntry(yamlText, entry);
          Deno.writeTextFileSync(filePath, updated);
          logger.info(
            `  applied log: appended entry (sections: ${
              entry.sections_changed.join(', ') || '(none)'
            })`,
          );
        } catch (logErr) {
          logger.error(
            `  applied log: DB commit succeeded but YAML write FAILED — ${logErr}. ` +
              `Re-run will no-op; manual edit may be needed.`,
          );
          return {
            file: filePath,
            ok: false,
            totalChanges: diff.total_changes,
            message: `applied-log write failed after successful apply: ${logErr}`,
          };
        }
      }

      return {
        file: filePath,
        ok: result.ok && result.errors.length === 0,
        totalChanges: diff.total_changes,
      };
    } catch (e) {
      if (e instanceof StaleDiffError) {
        return {
          file: filePath,
          ok: false,
          totalChanges: diff.total_changes,
          message: `stale_diff — re-run /review-recipe to refresh state. ${e.message}`,
        };
      }
      return {
        file: filePath,
        ok: false,
        totalChanges: diff.total_changes,
        message: `apply RPC error: ${e}`,
      };
    }
  }

  return { file: filePath, ok: true, totalChanges: diff.total_changes };
}

async function main() {
  // List subcommands are env-free and don't touch the DB — handle first.
  if (hasFlag(Deno.args, '--list-missing')) {
    Deno.exit(commandListMissing());
  }
  if (hasFlag(Deno.args, '--list-authoring')) {
    Deno.exit(commandListAuthoring());
  }
  if (hasFlag(Deno.args, '--list-applied')) {
    Deno.exit(commandListApplied());
  }
  if (hasFlag(Deno.args, '--list-unapplied')) {
    Deno.exit(commandListUnapplied());
  }

  const opts = parseOptions(Deno.args);
  const config = createPipelineConfig(opts.env);

  logger.section(
    `Apply recipe metadata (${opts.env})${
      opts.dryRun && !opts.apply ? ' [DRY RUN]' : opts.apply ? ' [APPLY]' : ''
    }`,
  );
  logger.info(`Files: ${opts.files.length}`);

  const outcomes: ProcessOutcome[] = [];
  for (const file of opts.files) {
    outcomes.push(await processFile(file, config, opts));
  }

  // -- summary
  const ok = outcomes.filter((o) => o.ok).length;
  const failed = outcomes.length - ok;
  const totalChanges = outcomes.reduce((acc, o) => acc + o.totalChanges, 0);

  logger.summary({
    'Files processed': outcomes.length,
    'Ok': ok,
    'Failed': failed,
    'Total changes (across files)': totalChanges,
  });

  if (failed > 0) {
    logger.warn('Failed files:');
    for (const o of outcomes.filter((o) => !o.ok)) {
      logger.error(`  ${o.file} — ${o.message}`);
    }
    Deno.exit(1);
  }
}

main().catch((error) => {
  logger.error('Fatal error', error);
  Deno.exit(1);
});
