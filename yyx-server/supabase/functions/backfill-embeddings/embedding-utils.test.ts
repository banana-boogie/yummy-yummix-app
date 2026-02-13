/**
 * Backfill Embedding Utilities Tests
 *
 * Verifies hash/model behavior and embedding text composition.
 */

import {
  assertEquals,
  assertNotEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";
import type { RecipeEmbeddingRow } from "../_shared/recipe-query-types.ts";
import {
  buildEmbeddingText,
  computeContentHash,
  getEmbeddingModel,
} from "./embedding-utils.ts";

function createRecipe(
  overrides: Partial<RecipeEmbeddingRow> = {},
): RecipeEmbeddingRow {
  return {
    id: "recipe-1",
    name_en: "Chicken Soup",
    name_es: "Sopa de Pollo",
    tips_and_tricks_en: "Use fresh herbs for better flavor.",
    tips_and_tricks_es: "Usa hierbas frescas para mejor sabor.",
    recipe_ingredients: [
      { ingredients: { name_en: "Zucchini", name_es: "Calabacita" } },
      { ingredients: { name_en: "Carrot", name_es: "Zanahoria" } },
    ],
    recipe_to_tag: [
      { recipe_tags: { name_en: "Comfort", name_es: "Casera" } },
      { recipe_tags: { name_en: "Dinner", name_es: "Cena" } },
    ],
    recipe_steps: [
      {
        order: 3,
        instruction_en: "Serve hot.",
        instruction_es: "Servir caliente.",
      },
      {
        order: 1,
        instruction_en: "Boil water.",
        instruction_es: "Hervir agua.",
      },
      {
        order: 4,
        instruction_en: "Optional garnish.",
        instruction_es: "Adorno opcional.",
      },
      {
        order: 2,
        instruction_en: "Add vegetables.",
        instruction_es: "Agregar verduras.",
      },
    ],
    ...overrides,
  };
}

Deno.test("getEmbeddingModel honors AI gateway embedding override", () => {
  const envVar = "AI_EMBEDDING_MODEL";
  const original = Deno.env.get(envVar);

  try {
    Deno.env.set(envVar, "test-embedding-model");
    assertEquals(getEmbeddingModel(), "test-embedding-model");
  } finally {
    if (original === undefined) {
      Deno.env.delete(envVar);
    } else {
      Deno.env.set(envVar, original);
    }
  }
});

Deno.test("computeContentHash changes when model changes", async () => {
  const text = "Recipe: Tomato Pasta";

  const hashA = await computeContentHash(text, "model-a");
  const hashB = await computeContentHash(text, "model-b");

  assertNotEquals(hashA, hashB);
});

Deno.test("buildEmbeddingText includes bilingual content and first 3 ordered EN steps", () => {
  const text = buildEmbeddingText(createRecipe());

  assertStringIncludes(text, "Recipe: Chicken Soup");
  assertStringIncludes(text, "Receta: Sopa de Pollo");
  assertStringIncludes(text, "Ingredients: Carrot, Zucchini");
  assertStringIncludes(text, "Ingredientes: Calabacita, Zanahoria");
  assertStringIncludes(text, "Tags: Comfort, Dinner");
  assertStringIncludes(text, "Etiquetas: Casera, Cena");
  assertStringIncludes(text, "Step 1: Boil water.");
  assertStringIncludes(text, "Step 3: Serve hot.");
  assertEquals(text.includes("Step 4:"), false);
});
