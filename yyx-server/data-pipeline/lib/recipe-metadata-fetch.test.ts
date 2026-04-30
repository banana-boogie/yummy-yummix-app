import { assertEquals } from 'std/assert/mod.ts';
import { slugifyName } from './recipe-metadata-fetch.ts';

// IMPORTANT: this implementation must produce the same string as the SQL
// helper public._recipe_metadata_slugify() in
// supabase/migrations/20260427050549_apply_recipe_metadata_rpc.sql.
// Drift here = false ingredient matches at apply time.

Deno.test('slugifyName: snake_case preservation for plain ASCII', () => {
  assertEquals(slugifyName('Flank Steak'), 'flank_steak');
  assertEquals(slugifyName('Soy Sauce'), 'soy_sauce');
  assertEquals(slugifyName('green onion'), 'green_onion');
});

Deno.test('slugifyName: strips Spanish accents', () => {
  assertEquals(slugifyName('Cebolla Morada'), 'cebolla_morada');
  assertEquals(slugifyName('Jalapeño'), 'jalapeno');
  assertEquals(slugifyName('Plátano'), 'platano');
  assertEquals(slugifyName('Cilantro Picado'), 'cilantro_picado');
});

Deno.test('slugifyName: collapses runs of non-alphanumeric to single underscore', () => {
  assertEquals(slugifyName('Salt & Pepper'), 'salt_pepper');
  assertEquals(slugifyName('a---b...c'), 'a_b_c');
});

Deno.test('slugifyName: trims leading/trailing underscores', () => {
  assertEquals(slugifyName('  hello  '), 'hello');
  assertEquals(slugifyName('!!yes!!'), 'yes');
});

Deno.test('slugifyName: handles empty / null gracefully', () => {
  assertEquals(slugifyName(''), '');
  assertEquals(slugifyName(null), '');
  assertEquals(slugifyName(undefined), '');
});
