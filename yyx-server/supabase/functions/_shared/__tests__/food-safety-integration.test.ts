import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  buildSafetyReminders,
  checkRecipeSafety,
  clearFoodSafetyCache,
} from "../food-safety.ts";
import { clearAliasCache } from "../ingredient-normalization.ts";

type AliasRow = {
  canonical: string;
  alias: string;
  language: "en" | "es";
};

type FoodSafetyRow = {
  ingredient_canonical: string;
  category: string;
  min_temp_c: number;
  min_temp_f: number;
  min_cook_min: number;
};

function createSupabaseMock(
  aliases: AliasRow[],
  safetyRules: FoodSafetyRow[],
) {
  return {
    from: (table: string) => ({
      select: async () => {
        if (table === "ingredient_aliases") {
          return { data: aliases, error: null };
        }
        if (table === "food_safety_rules") {
          return { data: safetyRules, error: null };
        }
        return { data: [], error: null };
      },
    }),
  } as any;
}

const BASE_ALIASES: AliasRow[] = [
  { canonical: "ground_beef", alias: "ground beef", language: "en" },
  { canonical: "ground_beef", alias: "carne molida", language: "es" },
  { canonical: "beef", alias: "beef steak", language: "en" },
];

const BASE_RULES: FoodSafetyRow[] = [
  {
    ingredient_canonical: "ground_beef",
    category: "ground_meat",
    min_temp_c: 70,
    min_temp_f: 160,
    min_cook_min: 10,
  },
  {
    ingredient_canonical: "beef",
    category: "red_meat",
    min_temp_c: 63,
    min_temp_f: 145,
    min_cook_min: 10,
  },
];

Deno.test("checkRecipeSafety uses strict ground beef rule for EN alias", async () => {
  clearAliasCache();
  clearFoodSafetyCache();

  const supabase = createSupabaseMock(BASE_ALIASES, BASE_RULES);
  const result = await checkRecipeSafety(
    supabase,
    [{ name: "ground beef", quantity: 1, unit: "lb" }],
    8,
    "imperial",
    "en",
  );

  assertEquals(result.safe, false);
  assertEquals(result.warnings.length, 1);
  assertStringIncludes(result.warnings[0], "Ground Beef");
  assertStringIncludes(result.warnings[0], "160°F");
});

Deno.test("checkRecipeSafety uses strict ground beef rule for ES alias", async () => {
  clearAliasCache();
  clearFoodSafetyCache();

  const supabase = createSupabaseMock(BASE_ALIASES, BASE_RULES);
  const result = await checkRecipeSafety(
    supabase,
    [{ name: "carne molida", quantity: 1, unit: "kg" }],
    8,
    "metric",
    "es",
  );

  assertEquals(result.safe, false);
  assertEquals(result.warnings.length, 1);
  assertStringIncludes(result.warnings[0], "Ground Beef");
  assertStringIncludes(result.warnings[0], "70°C");
});

Deno.test("checkRecipeSafety keeps whole-cut beef threshold for beef steak", async () => {
  clearAliasCache();
  clearFoodSafetyCache();

  const supabase = createSupabaseMock(BASE_ALIASES, BASE_RULES);
  const result = await checkRecipeSafety(
    supabase,
    [{ name: "beef steak", quantity: 1, unit: "lb" }],
    8,
    "imperial",
    "en",
  );

  assertEquals(result.safe, false);
  assertEquals(result.warnings.length, 1);
  assertStringIncludes(result.warnings[0], "145°F");
});

Deno.test("buildSafetyReminders normalizes aliases before matching rules", async () => {
  clearAliasCache();
  clearFoodSafetyCache();

  const supabase = createSupabaseMock(BASE_ALIASES, BASE_RULES);
  const reminders = await buildSafetyReminders(
    supabase,
    ["ground beef"],
    "imperial",
    "en",
  );

  assertStringIncludes(reminders, "Ground Beef");
  assertStringIncludes(reminders, "160°F");
});
