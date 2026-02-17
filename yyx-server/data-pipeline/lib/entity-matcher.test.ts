/**
 * Entity Matcher Tests
 *
 * Tests for matching parsed recipe entities against DB records:
 * - matchIngredient: exact/plural/prep-strip/fuzzy/DISTINCT_INGREDIENTS
 * - matchTag: exact/#prefix/case-insensitive
 * - matchUsefulItem: exact/case-insensitive
 * - matchMeasurementUnit: by ID/case-insensitive
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  type DbIngredient,
  type DbMeasurementUnit,
  type DbRecipeTag,
  type DbUsefulItem,
  matchIngredient,
  matchMeasurementUnit,
  matchTag,
  matchUsefulItem,
} from './entity-matcher.ts';

// ─── Test Data ────────────────────────────────────────────

const ingredients: DbIngredient[] = [
  {
    id: 'ing-1',
    name_en: 'Tomato',
    name_es: 'Tomate',
    plural_name_en: 'Tomatoes',
    plural_name_es: 'Tomates',
    image_url: '',
    nutritional_facts: null,
  },
  {
    id: 'ing-2',
    name_en: 'Sugar',
    name_es: 'Azúcar',
    plural_name_en: 'Sugar',
    plural_name_es: 'Azúcar',
    image_url: '',
    nutritional_facts: null,
  },
  {
    id: 'ing-3',
    name_en: 'Brown Sugar',
    name_es: 'Azúcar Moreno',
    plural_name_en: 'Brown Sugar',
    plural_name_es: 'Azúcar Moreno',
    image_url: '',
    nutritional_facts: null,
  },
  {
    id: 'ing-4',
    name_en: 'Olive Oil',
    name_es: 'Aceite de Oliva',
    plural_name_en: 'Olive Oil',
    plural_name_es: 'Aceite de Oliva',
    image_url: '',
    nutritional_facts: null,
  },
];

const tags: DbRecipeTag[] = [
  { id: 'tag-1', name_en: 'Breakfast', name_es: 'Desayuno', categories: ['meal'] },
  { id: 'tag-2', name_en: 'Vegan', name_es: 'Vegano', categories: ['diet'] },
];

const usefulItems: DbUsefulItem[] = [
  { id: 'ui-1', name_en: 'Whisk', name_es: 'Batidor', image_url: '' },
  { id: 'ui-2', name_en: 'Cutting Board', name_es: 'Tabla de Cortar', image_url: '' },
];

const units: DbMeasurementUnit[] = [
  {
    id: 'cup',
    type: 'volume',
    system: 'imperial',
    name_en: 'Cup',
    name_es: 'Taza',
    symbol_en: 'cup',
    symbol_es: 'tz',
  },
  {
    id: 'tbsp',
    type: 'volume',
    system: 'imperial',
    name_en: 'Tablespoon',
    name_es: 'Cucharada',
    symbol_en: 'tbsp',
    symbol_es: 'cda',
  },
];

// ============================================================
// matchIngredient
// ============================================================

Deno.test('matchIngredient - exact English name', () => {
  const result = matchIngredient({ nameEn: 'Tomato', nameEs: '' }, ingredients);
  assertEquals(result?.id, 'ing-1');
});

Deno.test('matchIngredient - exact Spanish name', () => {
  const result = matchIngredient({ nameEn: '', nameEs: 'Tomate' }, ingredients);
  assertEquals(result?.id, 'ing-1');
});

Deno.test('matchIngredient - plural English match', () => {
  const result = matchIngredient({ nameEn: 'Tomatoes', nameEs: '' }, ingredients);
  assertEquals(result?.id, 'ing-1');
});

Deno.test('matchIngredient - prep prefix stripping', () => {
  const result = matchIngredient({ nameEn: 'chopped Tomato', nameEs: '' }, ingredients);
  assertEquals(result?.id, 'ing-1');
});

Deno.test('matchIngredient - fuzzy match above threshold', () => {
  // "Tomat" vs "Tomato" — 5/6 = 0.833 >= 0.8
  const result = matchIngredient({ nameEn: 'Tomat', nameEs: '' }, ingredients);
  assertEquals(result?.id, 'ing-1');
});

Deno.test('matchIngredient - no match below threshold', () => {
  const result = matchIngredient({ nameEn: 'Xyz', nameEs: 'Xyz' }, ingredients);
  assertEquals(result, null);
});

Deno.test('matchIngredient - DISTINCT_INGREDIENTS: brown sugar does not match sugar', () => {
  // "brown sugar" searching against base "sugar" should NOT match sugar (ing-2)
  // but should match "Brown Sugar" (ing-3)
  const result = matchIngredient({ nameEn: 'brown sugar', nameEs: '' }, ingredients);
  assertEquals(result?.id, 'ing-3');
});

Deno.test('matchIngredient - case insensitive', () => {
  const result = matchIngredient({ nameEn: 'tomato', nameEs: '' }, ingredients);
  assertEquals(result?.id, 'ing-1');
});

Deno.test('matchIngredient - extra virgin prefix strip matches olive oil', () => {
  const result = matchIngredient({ nameEn: 'extra virgin Olive Oil', nameEs: '' }, ingredients);
  assertEquals(result?.id, 'ing-4');
});

// ============================================================
// matchTag
// ============================================================

Deno.test('matchTag - exact English match', () => {
  const result = matchTag('Breakfast', tags);
  assertEquals(result?.id, 'tag-1');
});

Deno.test('matchTag - hash prefix', () => {
  const result = matchTag('#Breakfast', tags);
  assertEquals(result?.id, 'tag-1');
});

Deno.test('matchTag - case insensitive', () => {
  const result = matchTag('vegan', tags);
  assertEquals(result?.id, 'tag-2');
});

Deno.test('matchTag - Spanish match', () => {
  const result = matchTag('Desayuno', tags);
  assertEquals(result?.id, 'tag-1');
});

Deno.test('matchTag - null on unknown', () => {
  const result = matchTag('Unknown', tags);
  assertEquals(result, null);
});

// ============================================================
// matchUsefulItem
// ============================================================

Deno.test('matchUsefulItem - exact match', () => {
  const result = matchUsefulItem({ nameEn: 'Whisk', nameEs: '' }, usefulItems);
  assertEquals(result?.id, 'ui-1');
});

Deno.test('matchUsefulItem - case insensitive', () => {
  const result = matchUsefulItem({ nameEn: 'whisk', nameEs: '' }, usefulItems);
  assertEquals(result?.id, 'ui-1');
});

Deno.test('matchUsefulItem - Spanish match', () => {
  const result = matchUsefulItem({ nameEn: '', nameEs: 'Tabla de Cortar' }, usefulItems);
  assertEquals(result?.id, 'ui-2');
});

Deno.test('matchUsefulItem - null on unknown', () => {
  const result = matchUsefulItem({ nameEn: 'Blender', nameEs: 'Licuadora' }, usefulItems);
  assertEquals(result, null);
});

// ============================================================
// matchMeasurementUnit
// ============================================================

Deno.test('matchMeasurementUnit - by ID', () => {
  const result = matchMeasurementUnit('cup', units);
  assertEquals(result?.id, 'cup');
});

Deno.test('matchMeasurementUnit - case insensitive ID', () => {
  const result = matchMeasurementUnit('CUP', units);
  assertEquals(result?.id, 'cup');
});

Deno.test('matchMeasurementUnit - null on unknown', () => {
  const result = matchMeasurementUnit('gallon', units);
  assertEquals(result, null);
});
