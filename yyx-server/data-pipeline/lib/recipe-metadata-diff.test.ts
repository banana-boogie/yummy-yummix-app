/**
 * Regression tests for computeRecipeMetadataDiff() — focused on the tag
 * section, since that's where category drift caused a real bug
 * (dish_type / primary_ingredient diffs were silently dropped).
 *
 * The fixture is deliberately minimal: only what the tag section reads.
 */

import { assert, assertEquals } from 'std/assert/mod.ts';
import {
  computeRecipeMetadataDiff,
  formatDiffForCli,
  formatRecipeSnapshot,
  formatRequiresAuthoring,
} from './recipe-metadata-diff.ts';
import type { CurrentRecipeState } from './recipe-metadata-fetch.ts';
import type { RecipeMetadata } from './recipe-metadata-schema.ts';
import { TAG_CATEGORIES } from './recipe-metadata-schema.ts';

function makeCurrent(
  tagsByCategory: Record<string, string[]> = {},
): CurrentRecipeState {
  return {
    recipe_id: '00000000-0000-0000-0000-000000000001',
    updated_at: '2026-01-01T00:00:00.000Z',
    name_en: 'Fixture',
    planner: {
      planner_role: null,
      alternate_planner_roles: [],
      meal_components: [],
      is_complete_meal: null,
      equipment_tags: [],
      cooking_level: null,
      leftovers_friendly: null,
      batch_friendly: null,
      max_household_size_supported: null,
      is_published: null,
    },
    timings: { prep_time: null, total_time: null, portions: null },
    translations: [],
    ingredients: [],
    steps: [],
    kitchen_tools: [],
    pairings: [],
    tags_by_category: tagsByCategory,
  };
}

function makeDesired(
  tags: NonNullable<RecipeMetadata['tags']> = {},
): RecipeMetadata {
  return {
    recipe_match: {
      id: '00000000-0000-0000-0000-000000000001',
      name_en: 'Fixture',
      expected_recipe_updated_at: '2026-01-01T00:00:00.000Z',
    },
    review: {
      reviewed_by_label: 'unit-test',
      reviewed_at: '2026-04-27T00:00:00.000Z',
    },
    tags,
  };
}

function tagSection(diff: ReturnType<typeof computeRecipeMetadataDiff>) {
  return diff.sections.find((s) => s.section === 'tags');
}

Deno.test('tags diff: covers all 7 Track H categories (drift guard)', () => {
  // Every category in the schema must produce a diff entry when the YAML
  // adds a new slug. If a category is missing from the diff iteration, this
  // test will fail for that category specifically.
  for (const category of TAG_CATEGORIES) {
    const desired = makeDesired({ [category]: ['fixture_slug'] });
    const current = makeCurrent({}); // recipe has no tags currently
    const diff = computeRecipeMetadataDiff(desired, current);
    const tags = tagSection(diff);
    assert(tags, `expected tags section in diff (category=${category})`);
    const additions = tags.changes.filter((c) =>
      c.path === `tags.${category}.+`
    );
    assertEquals(
      additions.length,
      1,
      `expected one addition for category=${category}`,
    );
    assertEquals(additions[0].after, 'fixture_slug');
  }
});

Deno.test('tags diff: dish_type slug addition is captured', () => {
  const desired = makeDesired({ dish_type: ['stew', 'taco'] });
  const current = makeCurrent({ dish_type: ['stew'] });
  const diff = computeRecipeMetadataDiff(desired, current);
  const tags = tagSection(diff);
  assert(tags);
  const additions = tags.changes.filter((c) => c.path === 'tags.dish_type.+');
  assertEquals(additions.length, 1);
  assertEquals(additions[0].after, 'taco');
});

Deno.test('tags diff: primary_ingredient slug removal is captured', () => {
  const desired = makeDesired({ primary_ingredient: ['beef'] });
  const current = makeCurrent({ primary_ingredient: ['beef', 'pork'] });
  const diff = computeRecipeMetadataDiff(desired, current);
  const tags = tagSection(diff);
  assert(tags);
  const removals = tags.changes.filter((c) =>
    c.path === 'tags.primary_ingredient.-'
  );
  assertEquals(removals.length, 1);
  assertEquals(removals[0].before, 'pork');
});

Deno.test('tags diff: omitted category in YAML is left untouched', () => {
  // YAML only mentions cuisine; primary_ingredient is omitted. Diff must
  // NOT report removals for primary_ingredient even though current has tags
  // there — declarative-set semantics only kick in for categories the YAML
  // explicitly specifies.
  const desired = makeDesired({ cuisine: ['mexican'] });
  const current = makeCurrent({
    cuisine: ['mexican'],
    primary_ingredient: ['beef'],
  });
  const diff = computeRecipeMetadataDiff(desired, current);
  const tags = tagSection(diff);
  assert(tags);
  const piEntries = tags.changes.filter((c) =>
    c.path.startsWith('tags.primary_ingredient.')
  );
  assertEquals(piEntries.length, 0);
});

Deno.test('tags diff: identical state produces zero changes', () => {
  const desired = makeDesired({
    cuisine: ['mexican'],
    dish_type: ['stew'],
    primary_ingredient: ['beef'],
  });
  const current = makeCurrent({
    cuisine: ['mexican'],
    dish_type: ['stew'],
    primary_ingredient: ['beef'],
  });
  const diff = computeRecipeMetadataDiff(desired, current);
  const tags = tagSection(diff);
  assert(tags);
  assertEquals(tags.changes.length, 0);
});

// ============================================================
// Renderer golden tests
// ============================================================
//
// formatDiffForCli, formatRecipeSnapshot, and formatRequiresAuthoring shape
// the entire human-facing dry-run output. Pin the exact lines so an
// accidental whitespace or label change shows up in CI.

Deno.test('formatDiffForCli: groups set adds by parent path with stripped section prefix', () => {
  const desired = makeDesired({
    cuisine: ['american'],
    meal_type: ['lunch', 'dinner'],
    practical: ['quick', 'make_ahead'],
  });
  const current = makeCurrent({});
  const diff = computeRecipeMetadataDiff(desired, current);
  const out = formatDiffForCli(diff, false);
  assert(out.includes('CHANGES (5)'), `expected total count header, got:\n${out}`);
  assert(out.includes('  tags:'), `expected [tags] section header, got:\n${out}`);
  assert(out.includes('+ cuisine: american'), `expected grouped cuisine add, got:\n${out}`);
  assert(out.includes('+ meal_type: lunch, dinner'), `expected grouped meal_type add, got:\n${out}`);
  assert(out.includes('+ practical: quick, make_ahead'), `expected grouped practical add, got:\n${out}`);
});

Deno.test('formatDiffForCli: zero-change diff renders the idempotency hint', () => {
  const desired = makeDesired();
  const current = makeCurrent();
  const diff = computeRecipeMetadataDiff(desired, current);
  const out = formatDiffForCli(diff, false);
  assert(out.includes('CHANGES (0)'));
  assert(out.includes('idempotent'));
});

Deno.test('formatRecipeSnapshot: emits one field per line under section headers', () => {
  const out = formatRecipeSnapshot({
    ...makeCurrent({ dish_type: ['dip_dressing'] }),
    name_en: 'Honey Dijon Dressing',
    planner: {
      planner_role: 'condiment',
      alternate_planner_roles: [],
      meal_components: [],
      is_complete_meal: false,
      equipment_tags: ['thermomix'],
      cooking_level: 'beginner',
      leftovers_friendly: null,
      batch_friendly: true,
      max_household_size_supported: null,
      is_published: true,
    },
    timings: { prep_time: 5, total_time: 5, portions: 10 },
    translations: [
      { locale: 'en', name: 'X', description: null, tips_and_tricks: null, scaling_notes: null },
      { locale: 'es', name: 'X', description: null, tips_and_tricks: null, scaling_notes: null },
    ],
  });
  assert(out.includes('RECIPE'));
  assert(out.includes('  Name:            Honey Dijon Dressing'));
  assert(out.includes('PLANNER'));
  assert(out.includes('  Role:            condiment'));
  assert(out.includes('  Equipment:       thermomix'));
  assert(out.includes('  Batch friendly:  yes'));
  assert(out.includes('  Leftovers:       —'), `expected em-dash for null leftovers, got:\n${out}`);
  assert(out.includes('TIMINGS'));
  assert(out.includes('  Prep:            5 min'));
  assert(out.includes('  Portions:        10'));
  assert(out.includes('CONTENT'));
  assert(out.includes('  Locales:         en, es'));
  assert(out.includes('TAGS'));
  assert(out.includes('  dish_type:       dip_dressing'));
});

Deno.test('formatRequiresAuthoring: returns empty when no reasons', () => {
  assertEquals(formatRequiresAuthoring(undefined), '');
  assertEquals(formatRequiresAuthoring({ reasons: [] }), '');
});

Deno.test('formatRequiresAuthoring: preserves blank lines from YAML notes', () => {
  const out = formatRequiresAuthoring({
    reasons: ['missing_step_translation'],
    notes: 'first paragraph.\n\nsecond paragraph.\n\nthird.',
  });
  assert(out.includes('REQUIRES AUTHORING'));
  assert(out.includes('Reasons:   missing_step_translation'));
  assert(out.includes('    first paragraph.'));
  assert(out.includes('    second paragraph.'));
  // Two blank lines between paragraphs (from \n\n) — assert the indent does
  // not leak whitespace onto blank lines.
  assert(/\n\n {4}second paragraph\./.test(out), `expected blank-line preservation, got:\n${out}`);
});
