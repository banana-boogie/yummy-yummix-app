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
    translation_counts_by_locale: {},
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
    const additions = tags.changes.filter((c) => c.path === `tags.${category}.+`);
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
  const removals = tags.changes.filter((c) => c.path === 'tags.primary_ingredient.-');
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
  const piEntries = tags.changes.filter((c) => c.path.startsWith('tags.primary_ingredient.'));
  assertEquals(piEntries.length, 0);
});

// ============================================================
// ingredient_updates notes / section diff
// ============================================================

function makeIngredient(opts: {
  id?: string;
  slug: string;
  display_order: number;
  translations?: {
    locale: string;
    notes?: string | null;
    recipe_section?: string | null;
  }[];
}) {
  return {
    id: opts.id ?? `ing-${opts.slug}-${opts.display_order}`,
    ingredient_id: `ingredient-${opts.slug}`,
    display_order: opts.display_order,
    measurement_unit_id: null,
    quantity: 1,
    optional: false,
    name_en: opts.slug,
    slug: opts.slug,
    translations: (opts.translations ?? []).map((t) => ({
      locale: t.locale,
      notes: t.notes ?? null,
      recipe_section: t.recipe_section ?? null,
    })),
  };
}

function ingredientSection(diff: ReturnType<typeof computeRecipeMetadataDiff>) {
  return diff.sections.find((s) => s.section === 'ingredient_updates');
}

Deno.test('ingredient_updates diff: surfaces a notes_es change against current state', () => {
  const desired: RecipeMetadata = {
    ...makeDesired(),
    ingredient_updates: [{
      match: { ingredient_slug: 'salt', display_order: 5 },
      notes_es: 'al gusto',
    }],
  };
  const current = {
    ...makeCurrent(),
    ingredients: [makeIngredient({
      slug: 'salt',
      display_order: 5,
      translations: [{ locale: 'es', notes: 'a la sazón' }],
    })],
  };
  const sec = ingredientSection(computeRecipeMetadataDiff(desired, current));
  assert(sec);
  // Should emit exactly one change for the notes_es update.
  assertEquals(sec.changes.length, 1);
  assertEquals(sec.changes[0].path, 'ingredient_updates[salt@5].notes_es');
  assertEquals(sec.changes[0].before, 'a la sazón');
  assertEquals(sec.changes[0].after, 'al gusto');
});

Deno.test('ingredient_updates diff: surfaces a section_es change with no other edits', () => {
  // Regression test for the testing finding: the YAML's only edit is
  // section_es and the dry-run was previously silent on it.
  const desired: RecipeMetadata = {
    ...makeDesired(),
    ingredient_updates: [{
      match: { ingredient_slug: 'salt', display_order: 5 },
      section_es: 'Principal',
    }],
  };
  const current = {
    ...makeCurrent(),
    ingredients: [makeIngredient({
      slug: 'salt',
      display_order: 5,
      translations: [{ locale: 'es', recipe_section: 'Plato principal' }],
    })],
  };
  const sec = ingredientSection(computeRecipeMetadataDiff(desired, current));
  assert(sec);
  assertEquals(sec.changes.length, 1);
  assertEquals(sec.changes[0].path, 'ingredient_updates[salt@5].section_es');
  assertEquals(sec.changes[0].before, 'Plato principal');
  assertEquals(sec.changes[0].after, 'Principal');
});

Deno.test('ingredient_updates diff: identical notes produce no change', () => {
  const desired: RecipeMetadata = {
    ...makeDesired(),
    ingredient_updates: [{
      match: { ingredient_slug: 'salt', display_order: 5 },
      notes_es: 'al gusto',
    }],
  };
  const current = {
    ...makeCurrent(),
    ingredients: [makeIngredient({
      slug: 'salt',
      display_order: 5,
      translations: [{ locale: 'es', notes: 'al gusto' }],
    })],
  };
  const sec = ingredientSection(computeRecipeMetadataDiff(desired, current));
  assert(sec);
  assertEquals(sec.changes.length, 0);
});

Deno.test('ingredient_updates diff: bootstrap (no translation row yet) treats current as null', () => {
  const desired: RecipeMetadata = {
    ...makeDesired(),
    ingredient_updates: [{
      match: { ingredient_slug: 'salt', display_order: 5 },
      notes_es: 'al gusto',
    }],
  };
  const current = {
    ...makeCurrent(),
    ingredients: [makeIngredient({
      slug: 'salt',
      display_order: 5,
      translations: [], // no es row yet
    })],
  };
  const sec = ingredientSection(computeRecipeMetadataDiff(desired, current));
  assert(sec);
  assertEquals(sec.changes.length, 1);
  assertEquals(sec.changes[0].before, null);
  assertEquals(sec.changes[0].after, 'al gusto');
});

// ============================================================
// step_text_overrides diff
// ============================================================

function makeStep(opts: {
  id?: string;
  order: number;
  translations?: {
    locale: string;
    instruction?: string | null;
    recipe_section?: string | null;
    tip?: string | null;
  }[];
}) {
  return {
    id: opts.id ?? `step-${opts.order}`,
    order: opts.order,
    thermomix_time: null,
    thermomix_speed: null,
    thermomix_speed_start: null,
    thermomix_speed_end: null,
    thermomix_temperature: null,
    thermomix_temperature_unit: null,
    thermomix_mode: null,
    thermomix_is_blade_reversed: null,
    timer_seconds: null,
    translations: (opts.translations ?? []).map((t) => ({
      locale: t.locale,
      instruction: t.instruction ?? null,
      recipe_section: t.recipe_section ?? null,
      tip: t.tip ?? null,
    })),
    step_ingredients: [],
  };
}

function stepTextSection(diff: ReturnType<typeof computeRecipeMetadataDiff>) {
  return diff.sections.find((s) => s.section === 'step_text_overrides');
}

Deno.test('step_text_overrides diff: emits one entry per locale+field that differs', () => {
  const desired: RecipeMetadata = {
    ...makeDesired(),
    step_text_overrides: [{
      match: { order: 2 },
      translations: {
        es: { instruction: 'Agrega el pollo deshebrado.' },
      },
    }],
  };
  const current = {
    ...makeCurrent(),
    steps: [makeStep({
      order: 2,
      translations: [
        { locale: 'es', instruction: 'Añade el pollo deshebrado.' },
      ],
    })],
  };
  const diff = computeRecipeMetadataDiff(desired, current);
  const sec = stepTextSection(diff);
  assert(sec);
  assertEquals(sec.changes.length, 1);
  assertEquals(sec.changes[0].path, 'step_text_overrides[order=2].es.instruction');
  assertEquals(sec.changes[0].before, 'Añade el pollo deshebrado.');
  assertEquals(sec.changes[0].after, 'Agrega el pollo deshebrado.');
});

Deno.test('step_text_overrides diff: identical text produces no change', () => {
  const desired: RecipeMetadata = {
    ...makeDesired(),
    step_text_overrides: [{
      match: { order: 1 },
      translations: { en: { instruction: 'Stir well.' } },
    }],
  };
  const current = {
    ...makeCurrent(),
    steps: [makeStep({
      order: 1,
      translations: [{ locale: 'en', instruction: 'Stir well.' }],
    })],
  };
  const sec = stepTextSection(computeRecipeMetadataDiff(desired, current));
  assert(sec);
  assertEquals(sec.changes.length, 0);
});

Deno.test('step_text_overrides diff: missing translation row treats current as null', () => {
  // Recipe has no es row for this step yet; the diff should show the desired
  // text being inserted (before=null), not silently no-op.
  const desired: RecipeMetadata = {
    ...makeDesired(),
    step_text_overrides: [{
      match: { order: 1 },
      translations: { es: { instruction: 'Mezcla bien.' } },
    }],
  };
  const current = {
    ...makeCurrent(),
    steps: [makeStep({
      order: 1,
      translations: [{ locale: 'en', instruction: 'Stir well.' }],
    })],
  };
  const sec = stepTextSection(computeRecipeMetadataDiff(desired, current));
  assert(sec);
  assertEquals(sec.changes.length, 1);
  assertEquals(sec.changes[0].before, null);
  assertEquals(sec.changes[0].after, 'Mezcla bien.');
});

Deno.test('step_text_overrides diff: surfaces unmatched step as ⚠ NO MATCH', () => {
  const desired: RecipeMetadata = {
    ...makeDesired(),
    step_text_overrides: [{
      match: { order: 99 },
      translations: { en: { instruction: 'Will not match.' } },
    }],
  };
  const current = makeCurrent();
  const sec = stepTextSection(computeRecipeMetadataDiff(desired, current));
  assert(sec);
  assertEquals(sec.changes.length, 1);
  assertEquals(typeof sec.changes[0].after, 'string');
  assert(String(sec.changes[0].after).includes('NO MATCH IN DB'));
});

Deno.test('step_text_overrides diff: ignores fields not present in YAML', () => {
  // YAML edits instruction only; recipe_section and tip differ in DB but
  // must not produce diff entries (omit = leave untouched).
  const desired: RecipeMetadata = {
    ...makeDesired(),
    step_text_overrides: [{
      match: { order: 1 },
      translations: { en: { instruction: 'New instruction.' } },
    }],
  };
  const current = {
    ...makeCurrent(),
    steps: [makeStep({
      order: 1,
      translations: [{
        locale: 'en',
        instruction: 'Old instruction.',
        recipe_section: 'Prep',
        tip: 'A tip.',
      }],
    })],
  };
  const sec = stepTextSection(computeRecipeMetadataDiff(desired, current));
  assert(sec);
  assertEquals(sec.changes.length, 1);
  assertEquals(sec.changes[0].path, 'step_text_overrides[order=1].en.instruction');
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
  assert(
    out.includes('+ meal_type: lunch, dinner'),
    `expected grouped meal_type add, got:\n${out}`,
  );
  assert(
    out.includes('+ practical: quick, make_ahead'),
    `expected grouped practical add, got:\n${out}`,
  );
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

Deno.test('cleanup.delete_locales: attaches per-layer row counts and renders breakdown', () => {
  const desired: RecipeMetadata = {
    ...makeDesired(),
    cleanup: { delete_locales: ['es-ES'] },
  };
  const current: CurrentRecipeState = {
    ...makeCurrent(),
    translation_counts_by_locale: {
      'es-ES': { recipe: 1, steps: 7, ingredients: 0 },
    },
  };
  const diff = computeRecipeMetadataDiff(desired, current);
  const cleanup = diff.sections.find((s) => s.section === 'cleanup');
  assert(cleanup);
  assertEquals(cleanup.changes.length, 1);
  assertEquals(cleanup.changes[0].details, {
    recipe_translations: 1,
    step_translations: 7,
    ingredient_translations: 0,
  });

  const out = formatDiffForCli(diff, false);
  assert(out.includes("~ delete_locales: 'es-ES' → null"));
  assert(out.includes('recipe_translations'));
  assert(/recipe_translations\s+1 row\b/.test(out), `expected '1 row', got:\n${out}`);
  assert(/step_translations\s+7 rows\b/.test(out), `expected '7 rows', got:\n${out}`);
  assert(/ingredient_translations\s+0 rows\b/.test(out));
});

Deno.test('cleanup.delete_locales: skips locales with zero rows at every layer', () => {
  const desired: RecipeMetadata = {
    ...makeDesired(),
    cleanup: { delete_locales: ['fr'] },
  };
  const current: CurrentRecipeState = {
    ...makeCurrent(),
    translation_counts_by_locale: {},
  };
  const diff = computeRecipeMetadataDiff(desired, current);
  const cleanup = diff.sections.find((s) => s.section === 'cleanup');
  assert(cleanup);
  assertEquals(
    cleanup.changes.length,
    0,
    'expected no diff entry when locale has zero rows at every layer',
  );
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

// ============================================================
// step_ingredient_updates / _adds / _removes
// ============================================================

function makeStepWithLink(
  order: number,
  link: {
    slug: string;
    quantity?: number | null;
    unit?: string | null;
    display_order?: number;
  },
) {
  return {
    id: `step-${order}`,
    order,
    thermomix_time: null,
    thermomix_speed: null,
    thermomix_speed_start: null,
    thermomix_speed_end: null,
    thermomix_temperature: null,
    thermomix_temperature_unit: null,
    thermomix_mode: null,
    thermomix_is_blade_reversed: null,
    timer_seconds: null,
    translations: [],
    step_ingredients: [
      {
        id: `link-${order}-${link.slug}`,
        ingredient_id: `ing-${link.slug}`,
        slug: link.slug,
        display_order: link.display_order ?? 1,
        quantity: link.quantity ?? null,
        measurement_unit_id: link.unit ?? null,
      },
    ],
  };
}

function withSteps(
  steps: ReturnType<typeof makeStepWithLink>[],
  ingredients: { slug: string; display_order: number }[] = [],
): CurrentRecipeState {
  const base = makeCurrent({});
  return {
    ...base,
    steps,
    ingredients: ingredients.map((i) => ({
      id: `ri-${i.slug}`,
      ingredient_id: `ing-${i.slug}`,
      display_order: i.display_order,
      measurement_unit_id: null,
      quantity: null,
      optional: false,
      name_en: i.slug,
      slug: i.slug,
      translations: [],
    })),
  };
}

function makeDesiredWithStepIng(overrides: Partial<RecipeMetadata>): RecipeMetadata {
  return { ...makeDesired(), ...overrides };
}

function siSection(
  diff: ReturnType<typeof computeRecipeMetadataDiff>,
  name: 'step_ingredient_updates' | 'step_ingredient_adds' | 'step_ingredient_removes',
) {
  return diff.sections.find((s) => s.section === name);
}

Deno.test('step_ingredient_updates: emits change when quantity drifts', () => {
  const current = withSteps([
    makeStepWithLink(3, { slug: 'cornstarch', quantity: 20, unit: 'g' }),
  ]);
  const desired = makeDesiredWithStepIng({
    step_ingredient_updates: [
      { match: { order: 3, ingredient_slug: 'cornstarch' }, quantity: 30, unit: 'g' },
    ],
  });
  const sec = siSection(computeRecipeMetadataDiff(desired, current), 'step_ingredient_updates');
  assert(sec);
  assertEquals(sec.changes.length, 1);
  assertEquals(sec.changes[0].path, 'step_ingredient_updates[order=3,cornstarch]');
  assertEquals((sec.changes[0].after as Record<string, unknown>).quantity, 30);
});

Deno.test('step_ingredient_updates: no diff when YAML matches DB (idempotent)', () => {
  const current = withSteps([
    makeStepWithLink(3, { slug: 'cornstarch', quantity: 30, unit: 'g' }),
  ]);
  const desired = makeDesiredWithStepIng({
    step_ingredient_updates: [
      { match: { order: 3, ingredient_slug: 'cornstarch' }, quantity: 30, unit: 'g' },
    ],
  });
  const sec = siSection(computeRecipeMetadataDiff(desired, current), 'step_ingredient_updates');
  assert(sec);
  assertEquals(sec.changes.length, 0);
});

Deno.test('step_ingredient_updates: warns on missing step', () => {
  const current = withSteps([
    makeStepWithLink(2, { slug: 'cornstarch', quantity: 20, unit: 'g' }),
  ]);
  const desired = makeDesiredWithStepIng({
    step_ingredient_updates: [
      { match: { order: 9, ingredient_slug: 'cornstarch' }, quantity: 30 },
    ],
  });
  const sec = siSection(computeRecipeMetadataDiff(desired, current), 'step_ingredient_updates');
  assert(sec);
  assertEquals(sec.changes.length, 1);
  assert(String(sec.changes[0].after).includes('NO STEP MATCH'));
});

Deno.test('step_ingredient_updates: warns on missing link in step', () => {
  const current = withSteps([
    makeStepWithLink(3, { slug: 'salt', quantity: 5, unit: 'g' }),
  ]);
  const desired = makeDesiredWithStepIng({
    step_ingredient_updates: [
      { match: { order: 3, ingredient_slug: 'cornstarch' }, quantity: 30 },
    ],
  });
  const sec = siSection(computeRecipeMetadataDiff(desired, current), 'step_ingredient_updates');
  assert(sec);
  assertEquals(sec.changes.length, 1);
  assert(String(sec.changes[0].after).includes('NO STEP-INGREDIENT LINK'));
});

Deno.test('step_ingredient_updates: warns on duplicate (step, ingredient_slug) match', () => {
  // The DB only enforces uniqueness on (recipe_step_id, display_order); a
  // step can legitimately have two links to the same ingredient. Refuse
  // rather than silently mutate both.
  const current: CurrentRecipeState = (() => {
    const c = withSteps([]);
    c.steps = [
      {
        id: 'step-3',
        order: 3,
        thermomix_time: null,
        thermomix_speed: null,
        thermomix_speed_start: null,
        thermomix_speed_end: null,
        thermomix_temperature: null,
        thermomix_temperature_unit: null,
        thermomix_mode: null,
        thermomix_is_blade_reversed: null,
        timer_seconds: null,
        translations: [],
        step_ingredients: [
          {
            id: 'link-3-salt-a',
            ingredient_id: 'ing-salt',
            slug: 'salt',
            display_order: 1,
            quantity: 2,
            measurement_unit_id: 'g',
          },
          {
            id: 'link-3-salt-b',
            ingredient_id: 'ing-salt',
            slug: 'salt',
            display_order: 5,
            quantity: 3,
            measurement_unit_id: 'g',
          },
        ],
      },
    ];
    return c;
  })();
  const desired = makeDesiredWithStepIng({
    step_ingredient_updates: [
      { match: { order: 3, ingredient_slug: 'salt' }, quantity: 4 },
    ],
  });
  const sec = siSection(computeRecipeMetadataDiff(desired, current), 'step_ingredient_updates');
  assert(sec);
  assertEquals(sec.changes.length, 1);
  assert(String(sec.changes[0].after).includes('2 step-ingredient links match'));
});

Deno.test('step_ingredient_adds: emits change when link is missing', () => {
  const current = withSteps(
    [makeStepWithLink(2, { slug: 'water' })],
    [{ slug: 'zucchini', display_order: 1 }],
  );
  const desired = makeDesiredWithStepIng({
    step_ingredient_adds: [
      {
        match: { order: 2 },
        ingredient_slug: 'zucchini',
        quantity: 400,
        unit: 'g',
        display_order: 1,
      },
    ],
  });
  const sec = siSection(computeRecipeMetadataDiff(desired, current), 'step_ingredient_adds');
  assert(sec);
  assertEquals(sec.changes.length, 1);
  assertEquals(sec.changes[0].path, 'step_ingredient_adds[order=2,zucchini]');
});

Deno.test('step_ingredient_adds: idempotent when link already exists', () => {
  const current = withSteps(
    [makeStepWithLink(2, { slug: 'zucchini' })],
    [{ slug: 'zucchini', display_order: 1 }],
  );
  const desired = makeDesiredWithStepIng({
    step_ingredient_adds: [
      {
        match: { order: 2 },
        ingredient_slug: 'zucchini',
        quantity: 400,
        unit: 'g',
        display_order: 1,
      },
    ],
  });
  const sec = siSection(computeRecipeMetadataDiff(desired, current), 'step_ingredient_adds');
  assert(sec);
  assertEquals(sec.changes.length, 0);
});

Deno.test('step_ingredient_adds: same-YAML ingredient_adds satisfies recipe-level check', () => {
  // The RPC processes ingredient_adds before step_ingredient_adds. Dry-run
  // must mirror that ordering — a YAML that pairs both should produce a
  // clean add diff, not an orphan-link warning.
  const current = withSteps([makeStepWithLink(2, { slug: 'water' })]);
  const desired = makeDesiredWithStepIng({
    ingredient_adds: [
      { ingredient_slug: 'zucchini', quantity: 400, unit: 'g', display_order: 1 },
    ],
    step_ingredient_adds: [
      {
        match: { order: 2 },
        ingredient_slug: 'zucchini',
        quantity: 400,
        unit: 'g',
        display_order: 1,
      },
    ],
  });
  const sec = siSection(computeRecipeMetadataDiff(desired, current), 'step_ingredient_adds');
  assert(sec);
  assertEquals(sec.changes.length, 1);
  // The 'after' should be a structured object, not the orphan warning string.
  assert(typeof sec.changes[0].after === 'object', `expected structured after, got: ${sec.changes[0].after}`);
});

Deno.test('step_ingredient_adds: warns when ingredient_removes drops the only recipe-level row in the same YAML', () => {
  // RPC order: ingredient_removes runs before step_ingredient_adds, so a
  // YAML that removes the only recipe-level row for a slug AND adds a step-
  // level link to that same slug would orphan at apply time. Dry-run must
  // catch this — passing through `current` alone would falsely look clean.
  const current = withSteps(
    [makeStepWithLink(2, { slug: 'water' })],
    [{ slug: 'cilantro', display_order: 4 }],
  );
  const desired = makeDesiredWithStepIng({
    ingredient_removes: [
      { match: { ingredient_slug: 'cilantro', display_order: 4 } },
    ],
    step_ingredient_adds: [
      {
        match: { order: 2 },
        ingredient_slug: 'cilantro',
        quantity: 10,
        unit: 'g',
        display_order: 1,
      },
    ],
  });
  const sec = siSection(computeRecipeMetadataDiff(desired, current), 'step_ingredient_adds');
  assert(sec);
  assertEquals(sec.changes.length, 1);
  assert(String(sec.changes[0].after).includes('NO recipe-level ingredient'));
});

Deno.test('step_ingredient_adds: warns on orphan (no recipe-level + no ingredient_adds)', () => {
  const current = withSteps([makeStepWithLink(2, { slug: 'water' })]);
  const desired = makeDesiredWithStepIng({
    step_ingredient_adds: [
      {
        match: { order: 2 },
        ingredient_slug: 'cilantro',
        quantity: 10,
        unit: 'g',
        display_order: 4,
      },
    ],
  });
  const sec = siSection(computeRecipeMetadataDiff(desired, current), 'step_ingredient_adds');
  assert(sec);
  assertEquals(sec.changes.length, 1);
  assert(String(sec.changes[0].after).includes('NO recipe-level ingredient'));
});

Deno.test('step_ingredient_removes: emits change when link exists', () => {
  const current = withSteps([
    makeStepWithLink(4, { slug: 'cilantro', quantity: 10, unit: 'g' }),
  ]);
  const desired = makeDesiredWithStepIng({
    step_ingredient_removes: [
      { match: { order: 4, ingredient_slug: 'cilantro' } },
    ],
  });
  const sec = siSection(computeRecipeMetadataDiff(desired, current), 'step_ingredient_removes');
  assert(sec);
  assertEquals(sec.changes.length, 1);
  assertEquals(sec.changes[0].path, 'step_ingredient_removes[order=4,cilantro]');
});

Deno.test('step_ingredient_removes: idempotent when link already absent', () => {
  const current = withSteps([
    makeStepWithLink(4, { slug: 'salt' }),
  ]);
  const desired = makeDesiredWithStepIng({
    step_ingredient_removes: [
      { match: { order: 4, ingredient_slug: 'cilantro' } },
    ],
  });
  const sec = siSection(computeRecipeMetadataDiff(desired, current), 'step_ingredient_removes');
  assert(sec);
  assertEquals(sec.changes.length, 0);
});

Deno.test('step_ingredient_removes: warns on duplicate (step, ingredient_slug) match', () => {
  const current: CurrentRecipeState = (() => {
    const c = withSteps([]);
    c.steps = [
      {
        id: 'step-4',
        order: 4,
        thermomix_time: null,
        thermomix_speed: null,
        thermomix_speed_start: null,
        thermomix_speed_end: null,
        thermomix_temperature: null,
        thermomix_temperature_unit: null,
        thermomix_mode: null,
        thermomix_is_blade_reversed: null,
        timer_seconds: null,
        translations: [],
        step_ingredients: [
          {
            id: 'link-4-cilantro-a',
            ingredient_id: 'ing-cilantro',
            slug: 'cilantro',
            display_order: 1,
            quantity: 5,
            measurement_unit_id: 'g',
          },
          {
            id: 'link-4-cilantro-b',
            ingredient_id: 'ing-cilantro',
            slug: 'cilantro',
            display_order: 2,
            quantity: 3,
            measurement_unit_id: 'g',
          },
        ],
      },
    ];
    return c;
  })();
  const desired = makeDesiredWithStepIng({
    step_ingredient_removes: [
      { match: { order: 4, ingredient_slug: 'cilantro' } },
    ],
  });
  const sec = siSection(computeRecipeMetadataDiff(desired, current), 'step_ingredient_removes');
  assert(sec);
  assertEquals(sec.changes.length, 1);
  assert(String(sec.changes[0].after).includes('2 step-ingredient links match'));
});
