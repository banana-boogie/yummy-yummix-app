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
    recipe_translations: [
      {
        locale: "en",
        name: "Chicken Soup",
        tips_and_tricks: "Use fresh herbs for better flavor.",
      },
      {
        locale: "es",
        name: "Sopa de Pollo",
        tips_and_tricks: "Usa hierbas frescas para mejor sabor.",
      },
    ],
    recipe_ingredients: [
      {
        ingredients: {
          ingredient_translations: [
            { locale: "en", name: "Zucchini" },
            { locale: "es", name: "Calabacita" },
          ],
        },
      },
      {
        ingredients: {
          ingredient_translations: [
            { locale: "en", name: "Carrot" },
            { locale: "es", name: "Zanahoria" },
          ],
        },
      },
    ],
    recipe_to_tag: [
      {
        recipe_tags: {
          recipe_tag_translations: [
            { locale: "en", name: "Comfort" },
            { locale: "es", name: "Casera" },
          ],
        },
      },
      {
        recipe_tags: {
          recipe_tag_translations: [
            { locale: "en", name: "Dinner" },
            { locale: "es", name: "Cena" },
          ],
        },
      },
    ],
    recipe_steps: [
      {
        order: 3,
        recipe_step_translations: [
          { locale: "en", instruction: "Serve hot." },
          { locale: "es", instruction: "Servir caliente." },
        ],
      },
      {
        order: 1,
        recipe_step_translations: [
          { locale: "en", instruction: "Boil water." },
          { locale: "es", instruction: "Hervir agua." },
        ],
      },
      {
        order: 4,
        recipe_step_translations: [
          { locale: "en", instruction: "Optional garnish." },
          { locale: "es", instruction: "Adorno opcional." },
        ],
      },
      {
        order: 2,
        recipe_step_translations: [
          { locale: "en", instruction: "Add vegetables." },
          { locale: "es", instruction: "Agregar verduras." },
        ],
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
