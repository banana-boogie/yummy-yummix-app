import { getProviderConfig } from "../_shared/ai-gateway/index.ts";
import type { RecipeEmbeddingRow } from "../_shared/recipe-query-types.ts";

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

  // Recipe names
  if (recipe.name_en) sections.push(`Recipe: ${recipe.name_en}`);
  if (recipe.name_es) sections.push(`Receta: ${recipe.name_es}`);

  // Ingredients (both languages)
  const ingredientsEN = (recipe.recipe_ingredients || [])
    .map((ri) => ri.ingredients?.name_en)
    .filter((name): name is string => !!name)
    .sort((a, b) => a.localeCompare(b));
  const ingredientsES = (recipe.recipe_ingredients || [])
    .map((ri) => ri.ingredients?.name_es)
    .filter((name): name is string => !!name)
    .sort((a, b) => a.localeCompare(b));

  if (ingredientsEN.length > 0) {
    sections.push(`Ingredients: ${ingredientsEN.join(", ")}`);
  }
  if (ingredientsES.length > 0) {
    sections.push(`Ingredientes: ${ingredientsES.join(", ")}`);
  }

  // Tags (both languages)
  const tagsEN = (recipe.recipe_to_tag || [])
    .map((rt) => rt.recipe_tags?.name_en)
    .filter((name): name is string => !!name)
    .sort((a, b) => a.localeCompare(b));
  const tagsES = (recipe.recipe_to_tag || [])
    .map((rt) => rt.recipe_tags?.name_es)
    .filter((name): name is string => !!name)
    .sort((a, b) => a.localeCompare(b));

  if (tagsEN.length > 0) sections.push(`Tags: ${tagsEN.join(", ")}`);
  if (tagsES.length > 0) sections.push(`Etiquetas: ${tagsES.join(", ")}`);

  // Tips (both languages, first 200 chars each)
  if (recipe.tips_and_tricks_en) {
    sections.push(`Tips: ${recipe.tips_and_tricks_en.slice(0, 200)}`);
  }
  if (recipe.tips_and_tricks_es) {
    sections.push(`Consejos: ${recipe.tips_and_tricks_es.slice(0, 200)}`);
  }

  // First 3 steps (EN only, for instruction context)
  const sortedSteps = (recipe.recipe_steps || [])
    .sort((a, b) => a.order - b.order)
    .slice(0, 3);
  for (const step of sortedSteps) {
    if (step.instruction_en) {
      sections.push(`Step ${step.order}: ${step.instruction_en.slice(0, 150)}`);
    }
  }

  return sections.join("\n");
}
