/**
 * EditRecipePage — loadRecipe useCallback deps regression test.
 *
 * Locks in the fix for the "locale toggle clobbers unsaved form edits" bug.
 *
 * Background: `loadRecipe` is a `useCallback` wrapping
 * `adminRecipeService.getRecipeById(id)`. Its result is written straight into
 * `setRecipe`, overwriting any unsaved form state. A `useEffect` fires
 * `loadRecipe()` whenever the callback reference changes — which happens
 * whenever any of its deps change.
 *
 * Including `displayLocale` in the deps array (as an earlier iteration of
 * this PR did, so pairings could be resolved server-side per locale) silently
 * re-fetches the full recipe on every EN↔ES toggle, blowing away the admin's
 * in-progress edits.
 *
 * Fix: pairing target names are resolved client-side from raw translations,
 * so `loadRecipe` depends ONLY on `id`. This test asserts that invariant by
 * reading the useCallback deps array from source. Structural but targeted —
 * any future refactor that re-adds `displayLocale` (or any other state) will
 * trip this test and the reviewer gets a clear signal about the data-loss
 * risk instead of discovering it in QA.
 */

import fs from 'fs';
import path from 'path';

describe('EditRecipePage — loadRecipe refetch invariant', () => {
  it('loadRecipe useCallback depends only on [id]', () => {
    const file = fs.readFileSync(
      path.resolve(__dirname, '../index.tsx'),
      'utf-8',
    );

    // Match the useCallback wrapping loadRecipe, capturing its deps array.
    // Allow arbitrary whitespace inside the callback body.
    const match = file.match(
      /const loadRecipe = useCallback\([\s\S]*?\}, \[([^\]]*)\]\);/,
    );
    expect(match).not.toBeNull();

    const depsRaw = match![1];
    // Normalize: strip whitespace and split on commas so we can assert exact
    // membership regardless of formatting.
    const deps = depsRaw
      .split(',')
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    // Only `id` should trigger a refetch. If you're seeing this fail after
    // adding a dep, route that locale / state concern through client-side
    // resolution on the already-loaded recipe instead of re-fetching it —
    // refetching here clobbers unsaved form state in `setRecipe`.
    expect(deps).toEqual(['id']);
  });
});
