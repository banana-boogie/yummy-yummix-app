import { assertEquals, assertStringIncludes } from 'std/assert/mod.ts';
import {
  createImageManifestItem,
  imageManifestToCsv,
  imageManifestToMarkdown,
  normalizeFileName,
} from './image-manifest.ts';

Deno.test('normalizeFileName removes accents and normalizes separators', () => {
  assertEquals(normalizeFileName('Crème brûlée (special)!'), 'creme_brulee_special');
});

Deno.test('createImageManifestItem builds expected file and path', () => {
  const item = createImageManifestItem('ingredient', 'ing-1', 'Brown Sugar', 'Azúcar Morena');

  assertEquals(item.storageBucket, 'ingredients');
  assertEquals(item.suggestedFileName, 'ingredient_brown_sugar.png');
  assertEquals(item.imagePath, 'images/ingredient_brown_sugar.png');
  assertEquals(item.displayName, 'Brown Sugar / Azúcar Morena');
});

Deno.test('imageManifestToCsv escapes quoted values', () => {
  const item = createImageManifestItem('recipe', 'r-1', 'Chef "Special"', 'Especial');
  const csv = imageManifestToCsv([item]);

  assertStringIncludes(csv, '"Chef ""Special"" / Especial"');
  assertStringIncludes(csv, '"recipes"');
});

Deno.test('imageManifestToMarkdown renders table rows', () => {
  const item = createImageManifestItem('useful_item', 'u-1', 'Chef Knife', 'Cuchillo');
  const md = imageManifestToMarkdown([item]);

  assertStringIncludes(md, '| useful_item | u-1 | Chef Knife / Cuchillo |');
  assertStringIncludes(md, 'Total items: 1');
});
