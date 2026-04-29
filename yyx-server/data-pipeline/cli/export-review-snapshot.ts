#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env
/**
 * Export Recipe Review Snapshot
 *
 * Captures the full review-time state for one or more recipes into a single
 * timestamped JSON file under
 *   yyx-server/data-pipeline/data/recipe-review-snapshots/
 * and updates `latest.json` to point at the new snapshot. The snapshot is
 * review input only — apply-recipe-metadata still talks to live Supabase and
 * is governed by the YAML's `recipe_match.expected_recipe_updated_at` stale-
 * diff guard.
 *
 * Usage:
 *   deno task pipeline:export-review-snapshot --local --scope published
 *   deno task pipeline:export-review-snapshot --local --scope published --label published-review
 *   deno task pipeline:export-review-snapshot --local --manifest /path/to/list.txt
 *
 * Flags:
 *   --local / --production   Target environment (required)
 *   --scope published        Snapshot every recipe with is_published=true
 *   --manifest <path>        Newline-separated file of recipe IDs or names
 *   --label <text>           Optional kebab-friendly label (sanitised)
 *   --out-dir <path>         Override default output dir (testing / preview)
 */

import { createPipelineConfig, hasFlag, parseEnvironment, parseFlag } from '../lib/config.ts';
import { Logger } from '../lib/logger.ts';
import {
  buildSnapshotFilename,
  fetchPublishedRecipeIds,
  fetchRecipeSnapshot,
  fetchTaxonomy,
  parseManifest,
  resolveManifest,
  type ReviewSnapshotFile,
  type ReviewSnapshotPointer,
  SNAPSHOT_VERSION,
  type SnapshotRecipe,
  type UnresolvedManifestEntry,
} from '../lib/recipe-review-snapshot.ts';

const logger = new Logger('export-review-snapshot');

const DEFAULT_OUT_DIR = new URL('../data/recipe-review-snapshots/', import.meta.url).pathname;

interface CliOptions {
  env: 'local' | 'production';
  scope: 'published' | 'manifest';
  manifestPath: string | null;
  label: string | null;
  outDir: string;
}

function parseOptions(args: string[]): CliOptions {
  const env = parseEnvironment(args);
  const manifestPath = parseFlag(args, '--manifest') ?? null;
  const scopePublished = parseFlag(args, '--scope') === 'published' ||
    hasFlag(args, '--scope-published');
  const label = parseFlag(args, '--label') ?? null;
  const outDir = parseFlag(args, '--out-dir') ?? DEFAULT_OUT_DIR;

  if (!scopePublished && !manifestPath) {
    logger.error('Must specify either --scope published or --manifest <path>');
    Deno.exit(1);
  }
  if (scopePublished && manifestPath) {
    logger.error('Cannot combine --scope published with --manifest');
    Deno.exit(1);
  }

  return {
    env,
    scope: manifestPath ? 'manifest' : 'published',
    manifestPath,
    label,
    outDir: outDir.endsWith('/') ? outDir : `${outDir}/`,
  };
}

async function main() {
  const opts = parseOptions(Deno.args);
  const config = createPipelineConfig(opts.env);

  logger.section(`Export recipe review snapshot (${opts.env}, scope=${opts.scope})`);

  // Resolve recipe IDs to include
  const ids: string[] = [];
  let unresolved: UnresolvedManifestEntry[] = [];

  if (opts.scope === 'published') {
    const published = await fetchPublishedRecipeIds(config.supabase);
    ids.push(...published);
    logger.info(`Published recipes: ${ids.length}`);
  } else if (opts.manifestPath) {
    let manifestText: string;
    try {
      manifestText = Deno.readTextFileSync(resolvePath(opts.manifestPath));
    } catch (e) {
      logger.error(`Failed to read manifest: ${e}`);
      Deno.exit(1);
    }
    const parsed = parseManifest(manifestText);
    logger.info(
      `Manifest parsed: ${parsed.ids.length} ids, ${parsed.names.length} names, ` +
        `${parsed.raw.length} total entries`,
    );
    const resolved = await resolveManifest(config.supabase, parsed);
    ids.push(...resolved.ids);
    unresolved = resolved.unresolved;

    for (const entry of unresolved) {
      if (entry.reason === 'not_found') {
        logger.warn(`  not found: ${entry.input}`);
      } else if (entry.reason === 'ambiguous') {
        logger.warn(
          `  ambiguous: "${entry.input}" matched ${entry.matches.length} recipes; ` +
            'use a UUID instead.',
        );
        for (const m of entry.matches) {
          logger.warn(`    - ${m.id}  ${m.name_en ?? '(no en)'} / ${m.name_es ?? '(no es)'}`);
        }
      }
    }

    if (ids.length === 0) {
      logger.error('No recipes from manifest resolved to a single recipe. Aborting export.');
      Deno.exit(1);
    }
  }

  // Fetch each recipe sequentially. Snapshots are review-input — small, ad-hoc
  // pipeline runs — so the simple loop is fine and keeps Supabase load low.
  const recipes: SnapshotRecipe[] = [];
  let fetched = 0;
  for (const id of ids) {
    try {
      const snap = await fetchRecipeSnapshot(config.supabase, id);
      if (!snap) {
        logger.warn(`  recipe ${id} not found at fetch time — skipping`);
        continue;
      }
      recipes.push(snap);
      fetched += 1;
      if (fetched % 10 === 0) logger.info(`  fetched ${fetched}/${ids.length}`);
    } catch (e) {
      logger.error(`  fetch ${id} failed: ${e}`);
    }
  }

  if (recipes.length === 0) {
    logger.error('No recipes captured. Aborting.');
    Deno.exit(1);
  }

  const taxonomy = await fetchTaxonomy(config.supabase);
  logger.info(
    `Taxonomy: ${taxonomy.recipe_tags.length} tag slugs, ` +
      `${taxonomy.kitchen_tool_names_en.length} kitchen-tool names`,
  );

  const createdAt = new Date();
  const filename = buildSnapshotFilename(createdAt, opts.label);
  const filePath = `${opts.outDir}${filename}`;
  ensureDir(opts.outDir);

  const file: ReviewSnapshotFile = {
    snapshot_version: SNAPSHOT_VERSION,
    created_at: createdAt.toISOString(),
    scope: opts.scope,
    label: opts.label,
    source: { environment: opts.env, supabase_url: config.supabaseUrl },
    recipe_count: recipes.length,
    recipes,
    unresolved_manifest_entries: unresolved,
    taxonomy,
  };

  Deno.writeTextFileSync(filePath, JSON.stringify(file, null, 2) + '\n');
  logger.success(`Wrote snapshot: ${filePath}`);

  const pointer: ReviewSnapshotPointer = {
    snapshot_file: filename,
    created_at: file.created_at,
    scope: file.scope,
    label: file.label,
    recipe_count: file.recipe_count,
  };
  const pointerPath = `${opts.outDir}latest.json`;
  Deno.writeTextFileSync(pointerPath, JSON.stringify(pointer, null, 2) + '\n');
  logger.success(`Updated pointer: ${pointerPath}`);

  logger.summary({
    'Snapshot file': filename,
    'Recipes captured': recipes.length,
    'Unresolved manifest entries': unresolved.length,
    'Scope': opts.scope,
    'Label': opts.label ?? '(none)',
  });
}

function ensureDir(path: string): void {
  try {
    Deno.mkdirSync(path, { recursive: true });
  } catch (e) {
    if (!(e instanceof Deno.errors.AlreadyExists)) throw e;
  }
}

function resolvePath(input: string): string {
  if (input.startsWith('/')) return input;
  return `${Deno.cwd()}/${input}`;
}

main().catch((error) => {
  logger.error('Fatal error', error);
  Deno.exit(1);
});
