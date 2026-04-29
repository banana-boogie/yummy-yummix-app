/**
 * Recipe Metadata Applied Log
 *
 * After each successful, change-producing `apply-recipe-metadata --apply`,
 * the CLI appends an entry to the YAML's `applied:` block so reviewers can
 * tell at a glance which YAMLs have been pushed to the live DB.
 *
 * Append-only. No-op applies (zero rows touched) intentionally do not write —
 * re-running --apply on an unchanged YAML is a common dev workflow and we
 * don't want noise. The first non-no-op apply is the meaningful event;
 * subsequent applies after edits append a fresh entry. The block is
 * YAML-only telemetry; the apply RPC never reads it.
 *
 * Reviewers must NEVER pre-fill `applied:` in a YAML they author. The apply
 * CLI is the only writer.
 */

import { isMap, isSeq, parseDocument, type YAMLMap, type YAMLSeq } from 'yaml';
import type { ApplyRpcCounts } from './recipe-metadata-apply.ts';

export interface AppliedEntry {
  applied_at: string;
  applied_by: string;
  pre_recipe_updated_at: string;
  post_recipe_updated_at: string;
  sections_changed: string[];
  environment?: 'local' | 'production';
}

/**
 * Map RPC count keys to human-readable section labels. The same section may
 * be touched by multiple count keys (e.g. tags_added + tags_removed both
 * surface as 'tags'); de-duplication preserves stable order.
 */
const COUNT_KEY_TO_SECTION: Record<keyof ApplyRpcCounts, string> = {
  planner: 'planner',
  timings: 'timings',
  translations_upserts: 'translations',
  translations_deletes: 'translations',
  name_overrides: 'name',
  ingredient_updates: 'ingredients',
  ingredient_adds: 'ingredients',
  ingredient_removes: 'ingredients',
  kitchen_tools_added: 'kitchen_tools',
  kitchen_tools_removed: 'kitchen_tools',
  pairings_added: 'pairings',
  pairings_removed: 'pairings',
  step_overrides: 'step_overrides',
  step_text_overrides: 'step_text',
  tags_added: 'tags',
  tags_removed: 'tags',
};

/**
 * Build the canonical `sections_changed` list from RPC counts. Returns
 * sections in the order they're declared above (planner → timings →
 * translations → … → tags), which matches the rubric's natural reading
 * order. Empty when every count is zero (no-op apply).
 */
export function sectionsFromCounts(counts: ApplyRpcCounts): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const key of Object.keys(COUNT_KEY_TO_SECTION) as Array<keyof ApplyRpcCounts>) {
    if ((counts[key] ?? 0) <= 0) continue;
    const section = COUNT_KEY_TO_SECTION[key];
    if (seen.has(section)) continue;
    seen.add(section);
    out.push(section);
  }
  return out;
}

/**
 * Resolve the username + environment label for `applied_by`. Falls back
 * gracefully when no env var is set so the field is always populated.
 */
export function resolveAppliedBy(env: 'local' | 'production'): string {
  const user = Deno.env.get('USER') || Deno.env.get('USERNAME') || 'unknown';
  return `${user}@${env}`;
}

/**
 * Append an entry to the YAML's `applied:` block AND advance
 * `recipe_match.expected_recipe_updated_at` to `entry.post_recipe_updated_at`.
 *
 * Both writes happen in the same Document mutation and one `toString()` →
 * one file write, so the YAML can never end up with an applied entry whose
 * `pre_recipe_updated_at` matches the YAML's expected timestamp. Without the
 * timestamp bump, re-running --apply on the just-applied YAML would fail with
 * `stale_diff` (live `recipes.updated_at` advanced past the pre-apply
 * expected value) — defeating the "re-run is a no-op" recovery story.
 *
 * Preserves comments, quoting style, and key order in the rest of the
 * document. Returns the updated YAML text. Idempotency note: this function
 * ALWAYS appends — the caller decides whether to skip on no-op (current
 * convention: skip).
 *
 * If the YAML has no `applied:` block, one is added at the end of the
 * document so it sits below the reviewer-authored sections.
 */
export function appendAppliedEntry(yamlText: string, entry: AppliedEntry): string {
  const doc = parseDocument(yamlText);
  if (doc.errors.length > 0) {
    throw new Error(
      `applied-log: refusing to write — YAML has parse errors: ${
        doc.errors.map((e) => e.message).join('; ')
      }`,
    );
  }

  const root = doc.contents;
  if (!root || !isMap(root)) {
    throw new Error('applied-log: YAML root must be a mapping');
  }
  const rootMap = root as YAMLMap;

  // Build the entry as a plain object; the yaml lib serialises it as a
  // standard mapping. Key order matches the AppliedEntry interface.
  const entryNode = doc.createNode({
    applied_at: entry.applied_at,
    applied_by: entry.applied_by,
    pre_recipe_updated_at: entry.pre_recipe_updated_at,
    post_recipe_updated_at: entry.post_recipe_updated_at,
    sections_changed: entry.sections_changed,
    ...(entry.environment ? { environment: entry.environment } : {}),
  });

  const existing = rootMap.get('applied', true);
  if (existing && isSeq(existing)) {
    (existing as YAMLSeq).add(entryNode);
  } else {
    const seq = doc.createNode([]) as YAMLSeq;
    seq.add(entryNode);
    rootMap.set('applied', seq);
  }

  // Advance recipe_match.expected_recipe_updated_at to the post-apply value so
  // the YAML stays in sync with the live row. Without this, the next --apply
  // immediately fails stale_diff against its own freshly-written DB state.
  const recipeMatch = rootMap.get('recipe_match', true);
  if (recipeMatch && isMap(recipeMatch)) {
    (recipeMatch as YAMLMap).set('expected_recipe_updated_at', entry.post_recipe_updated_at);
  } else {
    throw new Error(
      'applied-log: recipe_match block missing or not a mapping — cannot advance expected_recipe_updated_at',
    );
  }

  // lineWidth: 0 disables word-wrap of quoted strings — without this, a long
  // `description.en` quoted on one line in the source would be reflowed into a
  // folded block scalar on output, polluting git diffs with unrelated changes.
  return doc.toString({ lineWidth: 0 });
}

/**
 * Read the parsed `applied[]` array from a YAML, or null if the file does
 * not parse / has no `applied:` block. Used by the --list-applied and
 * --list-unapplied CLI flags. We re-parse the YAML rather than relying on
 * `parseRecipeMetadataYaml` so a YAML with a schema-invalid body section
 * (which would block apply) does not block list output.
 */
export function readAppliedEntries(yamlText: string): AppliedEntry[] | null {
  const doc = parseDocument(yamlText);
  if (doc.errors.length > 0) return null;
  const raw = doc.toJS({ mapAsMap: false });
  if (!raw || typeof raw !== 'object') return null;
  const applied = (raw as Record<string, unknown>).applied;
  if (!Array.isArray(applied)) return null;
  return applied as AppliedEntry[];
}
