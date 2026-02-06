import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { clearAllergenCache, loadAllergenGroups } from "../allergen-filter.ts";
import {
  clearAliasCache,
  normalizeIngredient,
} from "../ingredient-normalization.ts";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

Deno.test("normalizeIngredient performs one alias fetch for concurrent calls", async () => {
  clearAliasCache();

  let selectCalls = 0;
  const supabase = {
    from: (table: string) => ({
      select: async () => {
        if (table === "ingredient_aliases") {
          selectCalls++;
          await delay(10);
          return {
            data: [
              {
                canonical: "ground_beef",
                alias: "ground beef",
                language: "en",
              },
            ],
            error: null,
          };
        }
        return { data: [], error: null };
      },
    }),
  } as any;

  const results = await Promise.all([
    normalizeIngredient(supabase, "ground beef", "en"),
    normalizeIngredient(supabase, "ground beef", "en"),
    normalizeIngredient(supabase, "ground beef", "en"),
    normalizeIngredient(supabase, "ground beef", "en"),
  ]);

  assertEquals(selectCalls, 1);
  assertEquals(results, [
    "ground_beef",
    "ground_beef",
    "ground_beef",
    "ground_beef",
  ]);
});

Deno.test("loadAllergenGroups performs one fetch for concurrent calls", async () => {
  clearAllergenCache();

  let selectCalls = 0;
  const supabase = {
    from: (table: string) => ({
      select: async () => {
        if (table === "allergen_groups") {
          selectCalls++;
          await delay(10);
          return {
            data: [
              {
                category: "nuts",
                ingredient_canonical: "peanut",
                name_en: "peanut",
                name_es: "cacahuate",
              },
            ],
            error: null,
          };
        }
        return { data: [], error: null };
      },
    }),
  } as any;

  const [first, second, third] = await Promise.all([
    loadAllergenGroups(supabase),
    loadAllergenGroups(supabase),
    loadAllergenGroups(supabase),
  ]);

  assertEquals(selectCalls, 1);
  assertEquals(first.length, 1);
  assertEquals(second.length, 1);
  assertEquals(third.length, 1);
});
