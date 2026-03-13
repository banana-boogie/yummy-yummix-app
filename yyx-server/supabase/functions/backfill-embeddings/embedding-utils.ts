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

/** Locales to include in embedding text. All locale translations are
 *  concatenated into one embedding for cross-language search support.
 *  Add new locales here as content expands. */
const EMBEDDING_LOCALES = ["en", "es"];

/** Section header labels keyed by base language code. */
const SECTION_HEADERS: Record<string, {
  recipe: string;
  ingredients: string;
  tags: string;
  tips: string;
  step: string;
}> = {
  en: { recipe: "Recipe", ingredients: "Ingredients", tags: "Tags", tips: "Tips", step: "Step" },
  es: { recipe: "Receta", ingredients: "Ingredientes", tags: "Etiquetas", tips: "Consejos", step: "Paso" },
};

function getSectionHeaders(locale: string) {
  return SECTION_HEADERS[locale] ?? SECTION_HEADERS["en"];
}

/**
 * Build rich multilingual text for embedding generation.
 * Includes recipe name, ingredients, tags, tips, and first few steps
 * across all configured locales for cross-language search support.
 */
export function buildEmbeddingText(recipe: RecipeEmbeddingRow): string {
  const sections: string[] = [];
  const translations = recipe.recipe_translations || [];

  for (const locale of EMBEDDING_LOCALES) {
    const headers = getSectionHeaders(locale);
    const trans = pickTranslation(translations, [locale]);

    // Recipe name
    if (trans?.name) sections.push(`${headers.recipe}: ${trans.name}`);

    // Ingredients
    const ingredientNames = (recipe.recipe_ingredients || [])
      .map((ri) => {
        const iTrans = ri.ingredients?.ingredient_translations || [];
        return pickTranslation(iTrans, [locale])?.name;
      })
      .filter((name): name is string => !!name)
      .sort((a, b) => a.localeCompare(b));
    if (ingredientNames.length > 0) {
      sections.push(`${headers.ingredients}: ${ingredientNames.join(", ")}`);
    }

    // Tags
    const tagNames = (recipe.recipe_to_tag || [])
      .map((rt) => {
        const tTrans = rt.recipe_tags?.recipe_tag_translations || [];
        return pickTranslation(tTrans, [locale])?.name;
      })
      .filter((name): name is string => !!name)
      .sort((a, b) => a.localeCompare(b));
    if (tagNames.length > 0) {
      sections.push(`${headers.tags}: ${tagNames.join(", ")}`);
    }

    // Tips (first 200 chars)
    if (trans?.tips_and_tricks) {
      sections.push(`${headers.tips}: ${trans.tips_and_tricks.slice(0, 200)}`);
    }
  }

  // Steps — include first 3 steps from the first locale that has them
  const sortedSteps = (recipe.recipe_steps || [])
    .sort((a, b) => a.order - b.order)
    .slice(0, 3);
  for (const step of sortedSteps) {
    const stepTrans = step.recipe_step_translations || [];
    for (const locale of EMBEDDING_LOCALES) {
      const headers = getSectionHeaders(locale);
      const localeStep = pickTranslation(stepTrans, [locale]);
      if (localeStep?.instruction) {
        sections.push(
          `${headers.step} ${step.order}: ${localeStep.instruction.slice(0, 150)}`,
        );
        break; // one locale per step is enough for embedding context
      }
    }
  }

  return sections.join("\n");
}
