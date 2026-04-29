import { assert, assertEquals } from 'std/assert/mod.ts';
import { parseRecipeMetadataYaml } from './recipe-metadata-schema.ts';
import {
  appendAppliedEntry,
  type AppliedEntry,
  readAppliedEntries,
  sectionsFromCounts,
} from './recipe-metadata-applied-log.ts';
import type { ApplyRpcCounts } from './recipe-metadata-apply.ts';

const BASE_YAML = `# This is a top-of-file comment that must survive an applied-log append.
recipe_match:
  id: '11111111-1111-1111-1111-111111111111'
  name_en: 'Test Recipe'
  expected_recipe_updated_at: '2026-04-28T22:30:00.000Z'

review:
  reviewed_by_label: 'claude-test'
  reviewed_at: '2026-04-28T22:31:00.000Z'

planner:
  role: main
  meal_components: [protein]
  is_complete_meal: false
`;

const SAMPLE_ENTRY: AppliedEntry = {
  applied_at: '2026-04-28T22:35:00.000Z',
  applied_by: 'banana@local',
  pre_recipe_updated_at: '2026-04-28T22:30:00.000Z',
  post_recipe_updated_at: '2026-04-28T22:35:00.123456+00:00',
  sections_changed: ['planner', 'tags'],
  environment: 'local',
};

function zeroCounts(): ApplyRpcCounts {
  return {
    planner: 0,
    timings: 0,
    translations_upserts: 0,
    translations_deletes: 0,
    name_overrides: 0,
    ingredient_updates: 0,
    ingredient_adds: 0,
    ingredient_removes: 0,
    kitchen_tools_added: 0,
    kitchen_tools_removed: 0,
    pairings_added: 0,
    pairings_removed: 0,
    step_overrides: 0,
    tags_added: 0,
    tags_removed: 0,
  };
}

// ─── sectionsFromCounts ────────────────────────────────

Deno.test('sectionsFromCounts: empty when every count is zero (no-op apply)', () => {
  assertEquals(sectionsFromCounts(zeroCounts()), []);
});

Deno.test('sectionsFromCounts: deduplicates same section across multiple count keys', () => {
  const counts = zeroCounts();
  counts.tags_added = 2;
  counts.tags_removed = 1;
  counts.translations_upserts = 3;
  counts.translations_deletes = 1;
  // tags appears twice in the source map; should surface once.
  assertEquals(sectionsFromCounts(counts), ['translations', 'tags']);
});

Deno.test('sectionsFromCounts: ingredient_* keys all roll up to "ingredients"', () => {
  const counts = zeroCounts();
  counts.ingredient_updates = 1;
  counts.ingredient_adds = 1;
  counts.ingredient_removes = 1;
  assertEquals(sectionsFromCounts(counts), ['ingredients']);
});

Deno.test('sectionsFromCounts: full count surface produces canonical order', () => {
  const counts: ApplyRpcCounts = {
    planner: 1,
    timings: 1,
    translations_upserts: 1,
    translations_deletes: 0,
    name_overrides: 1,
    ingredient_updates: 1,
    ingredient_adds: 0,
    ingredient_removes: 0,
    kitchen_tools_added: 1,
    kitchen_tools_removed: 0,
    pairings_added: 1,
    pairings_removed: 0,
    step_overrides: 1,
    tags_added: 1,
    tags_removed: 0,
  };
  assertEquals(sectionsFromCounts(counts), [
    'planner',
    'timings',
    'translations',
    'name',
    'ingredients',
    'kitchen_tools',
    'pairings',
    'step_overrides',
    'tags',
  ]);
});

// ─── appendAppliedEntry ────────────────────────────────

Deno.test('appendAppliedEntry: adds applied: block when none exists', () => {
  const out = appendAppliedEntry(BASE_YAML, SAMPLE_ENTRY);
  // The result must round-trip through the schema parser without errors.
  const parsed = parseRecipeMetadataYaml(out);
  assertEquals(parsed.data.applied?.length, 1);
  const entry = parsed.data.applied![0];
  assertEquals(entry.applied_by, 'banana@local');
  assertEquals(entry.sections_changed, ['planner', 'tags']);
  assertEquals(entry.environment, 'local');
});

Deno.test('appendAppliedEntry: preserves the file-header comment', () => {
  const out = appendAppliedEntry(BASE_YAML, SAMPLE_ENTRY);
  assert(
    out.includes('# This is a top-of-file comment that must survive an applied-log append.'),
    'header comment was dropped during YAML round-trip',
  );
});

Deno.test('appendAppliedEntry: appends without removing prior entries', () => {
  const after1 = appendAppliedEntry(BASE_YAML, SAMPLE_ENTRY);
  const second: AppliedEntry = {
    applied_at: '2026-04-29T10:00:00.000Z',
    applied_by: 'banana@local',
    pre_recipe_updated_at: '2026-04-28T22:35:00.123456+00:00',
    post_recipe_updated_at: '2026-04-29T10:00:00.000000+00:00',
    sections_changed: ['ingredients'],
    environment: 'local',
  };
  const after2 = appendAppliedEntry(after1, second);
  const parsed = parseRecipeMetadataYaml(after2);
  assertEquals(parsed.data.applied?.length, 2);
  assertEquals(parsed.data.applied![0].sections_changed, ['planner', 'tags']);
  assertEquals(parsed.data.applied![1].sections_changed, ['ingredients']);
});

Deno.test('appendAppliedEntry: advances recipe_match.expected_recipe_updated_at to post value', () => {
  // Without this bump, re-applying the just-applied YAML would fail stale_diff
  // because live recipes.updated_at advanced past the pre-apply expected value.
  const out = appendAppliedEntry(BASE_YAML, SAMPLE_ENTRY);
  const parsed = parseRecipeMetadataYaml(out);
  assertEquals(
    parsed.data.recipe_match.expected_recipe_updated_at,
    SAMPLE_ENTRY.post_recipe_updated_at,
  );
});

Deno.test('appendAppliedEntry: does not reflow long quoted strings', () => {
  // A 200-char single-line description must stay on one line after the round
  // trip (lineWidth: 0). Reflowing would pollute the git diff with unrelated
  // formatting changes on every apply.
  const longLine =
    'Crispy skin-on chicken thighs with juicy dark meat, cooked in the air fryer with a simple paprika, garlic, and onion seasoning. A little baking powder helps the skin brown and crisp without deep-frying.';
  const yaml = `${BASE_YAML}
description:
  en: '${longLine}'
  es: 'es desc.'
`;
  const out = appendAppliedEntry(yaml, SAMPLE_ENTRY);
  // The original line must still appear verbatim; if reflowed it would be
  // split across multiple lines with leading whitespace.
  assert(
    out.includes(`'${longLine}'`),
    'long quoted string was reflowed instead of preserved on one line',
  );
});

Deno.test('appendAppliedEntry: omits environment field when not provided', () => {
  const entry: AppliedEntry = { ...SAMPLE_ENTRY };
  delete entry.environment;
  const out = appendAppliedEntry(BASE_YAML, entry);
  // The serialised YAML must not contain `environment:` for this entry.
  // (It will appear in later entries that do set it — this test isolates the
  // first entry.)
  assertEquals(out.includes('environment:'), false);
});

// ─── schema acceptance ─────────────────────────────────

Deno.test('schema: existing YAMLs without an applied block remain valid (backward-compat)', () => {
  const parsed = parseRecipeMetadataYaml(BASE_YAML);
  assertEquals(parsed.data.applied, undefined);
});

Deno.test('schema: rejects an applied entry missing required fields', () => {
  const bad = `${BASE_YAML}
applied:
  - applied_at: '2026-04-28T22:35:00.000Z'
    applied_by: 'banana@local'
`;
  let threw = false;
  try {
    parseRecipeMetadataYaml(bad);
  } catch {
    threw = true;
  }
  assert(threw, 'schema should reject an applied entry missing required fields');
});

// ─── readAppliedEntries ────────────────────────────────

Deno.test('readAppliedEntries: returns null for a YAML without applied:', () => {
  assertEquals(readAppliedEntries(BASE_YAML), null);
});

Deno.test('readAppliedEntries: returns the parsed entries for a YAML with applied:', () => {
  const out = appendAppliedEntry(BASE_YAML, SAMPLE_ENTRY);
  const entries = readAppliedEntries(out);
  assert(entries !== null);
  assertEquals(entries.length, 1);
  assertEquals(entries[0].applied_by, 'banana@local');
});

Deno.test('readAppliedEntries: returns null for unparseable YAML', () => {
  assertEquals(readAppliedEntries('not: valid: yaml: ['), null);
});
