import { getProviderConfig } from "../_shared/ai-gateway/index.ts";
import type { RecipeEmbeddingRow } from "../_shared/recipe-query-types.ts";
import { pickTranslation } from "../_shared/locale-utils.ts";

/**
 * Resolve the embedding model configured in AI Gateway.
 */
export function getEmbeddingModel(): string {
  return getProviderConfig("embedding").model;
}

/**
 * Compute SHA-256 content hash for a recipe.
 * Hash = SHA-256(embedding_model|full_embedding_text)
 */
export async function computeContentHash(
  embeddingText: string,
  embeddingModel: string,
): Promise<string> {
  const content = `${embeddingModel}|${embeddingText}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Build rich bilingual text for embedding generation.
 * Includes recipe name, ingredients, tags, tips, and first few steps
 * in both EN and ES for cross-language search support.
 */
export function buildEmbeddingText(recipe: RecipeEmbeddingRow): string {
  const sections: string[] = [];

  // Recipe names from translations
  const translations = recipe.recipe_translations || [];
  const enName = pickTranslation(translations, ["en"]);
  const esName = pickTranslation(translations, ["es"]);
  if (enName?.name) sections.push(`Recipe: ${enName.name}`);
  if (esName?.name) sections.push(`Receta: ${esName.name}`);

  // Ingredients (both languages from translations)
  const ingredientsEN = (recipe.recipe_ingredients || [])
    .map((ri) => {
      const trans = ri.ingredients?.ingredient_translations || [];
      const en = pickTranslation(trans, ["en"]);
      return en?.name;
    })
    .filter((name): name is string => !!name)
    .sort((a, b) => a.localeCompare(b));
  const ingredientsES = (recipe.recipe_ingredients || [])
    .map((ri) => {
      const trans = ri.ingredients?.ingredient_translations || [];
      const es = pickTranslation(trans, ["es"]);
      return es?.name;
    })
    .filter((name): name is string => !!name)
    .sort((a, b) => a.localeCompare(b));

  if (ingredientsEN.length > 0) {
    sections.push(`Ingredients: ${ingredientsEN.join(", ")}`);
  }
  if (ingredientsES.length > 0) {
    sections.push(`Ingredientes: ${ingredientsES.join(", ")}`);
  }

  // Tags (both languages from translations)
  const tagsEN = (recipe.recipe_to_tag || [])
    .map((rt) => {
      const trans = rt.recipe_tags?.recipe_tag_translations || [];
      const en = pickTranslation(trans, ["en"]);
      return en?.name;
    })
    .filter((name): name is string => !!name)
    .sort((a, b) => a.localeCompare(b));
  const tagsES = (recipe.recipe_to_tag || [])
    .map((rt) => {
      const trans = rt.recipe_tags?.recipe_tag_translations || [];
      const es = pickTranslation(trans, ["es"]);
      return es?.name;
    })
    .filter((name): name is string => !!name)
    .sort((a, b) => a.localeCompare(b));

  if (tagsEN.length > 0) sections.push(`Tags: ${tagsEN.join(", ")}`);
  if (tagsES.length > 0) sections.push(`Etiquetas: ${tagsES.join(", ")}`);

  // Tips (both languages from translations, first 200 chars each)
  const enTrans = pickTranslation(translations, ["en"]);
  const esTrans = pickTranslation(translations, ["es"]);
  if (enTrans?.tips_and_tricks) {
    sections.push(`Tips: ${enTrans.tips_and_tricks.slice(0, 200)}`);
  }
  if (esTrans?.tips_and_tricks) {
    sections.push(`Consejos: ${esTrans.tips_and_tricks.slice(0, 200)}`);
  }

  // First 3 steps (EN only, for instruction context)
  const sortedSteps = (recipe.recipe_steps || [])
    .sort((a, b) => a.order - b.order)
    .slice(0, 3);
  for (const step of sortedSteps) {
    const stepTrans = step.recipe_step_translations || [];
    const enStep = pickTranslation(stepTrans, ["en"]);
    if (enStep?.instruction) {
      sections.push(
        `Step ${step.order}: ${enStep.instruction.slice(0, 150)}`,
      );
    }
  }

  return sections.join("\n");
}
