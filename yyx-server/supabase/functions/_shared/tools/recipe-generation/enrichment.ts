/**
 * Post-generation enrichment: ingredient images and kitchen tool matching.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { GeneratedRecipe } from "../../irmixy-schemas.ts";
import { buildLocaleChain, pickTranslation } from "../../locale-utils.ts";

// ============================================================
// Ingredient Image Enrichment
// ============================================================

/**
 * Batch result type from batch_find_ingredients RPC
 */
type BatchIngredientMatch = {
  input_name: string;
  matched_name: string | null;
  image_url: string | null;
  match_score: number | null;
};

/**
 * Enrich ingredients with image URLs from the database.
 * Uses batch lookup for performance (single query instead of N+1).
 * Exported for testing.
 */
export async function enrichIngredientsWithImages(
  ingredients: Array<{
    name: string;
    quantity: number;
    unit: string;
    imageUrl?: string;
  }>,
  supabase: SupabaseClient,
  locale: string = "en",
): Promise<
  Array<{
    name: string;
    quantity: number;
    unit: string;
    imageUrl?: string;
  }>
> {
  if (ingredients.length === 0) {
    return ingredients;
  }

  // Single batch query for all ingredients
  const ingredientNames = ingredients.map((i) => i.name);
  const { data: matches, error } = await supabase.rpc(
    "batch_find_ingredients",
    {
      ingredient_names: ingredientNames,
      preferred_locale: locale,
    },
  );

  if (error) {
    console.warn("[Batch lookup] RPC error:", error.message);
    // Return original ingredients without images on error
    return ingredients;
  }

  // Create a lookup map from input_name to match result
  const matchMap = new Map<string, BatchIngredientMatch>();
  for (const match of (matches as BatchIngredientMatch[]) || []) {
    if (match.input_name) {
      matchMap.set(match.input_name.toLowerCase(), match);
    }
  }

  // Enrich ingredients with matched image URLs
  const enriched = ingredients.map((ingredient) => {
    const match = matchMap.get(ingredient.name.toLowerCase());

    if (match?.image_url) {
      return { ...ingredient, imageUrl: match.image_url };
    }

    return { ...ingredient, imageUrl: undefined };
  });

  // Log summary instead of per-ingredient details
  const matched = enriched.filter((i) => i.imageUrl).length;
  console.log(
    `[Batch lookup] ${matched}/${ingredients.length} ingredients matched with images`,
  );

  return enriched;
}

// ============================================================
// Kitchen Tool Enrichment
// ============================================================

interface KitchenToolTranslationRow {
  locale: string;
  name: string | null;
}

type KitchenToolRow = {
  id: string;
  kitchen_tool_translations: KitchenToolTranslationRow[];
  image_url: string | null;
};

const KITCHEN_TOOLS_CACHE_TTL_MS = 5 * 60 * 1000;
let kitchenToolsCache: KitchenToolRow[] | null = null;
let kitchenToolsCacheTimestamp = 0;

/** Clear the kitchen tools cache (exported for testing). */
export function clearKitchenToolsCache(): void {
  kitchenToolsCache = null;
  kitchenToolsCacheTimestamp = 0;
}

/**
 * Fetch all kitchen tools from the database, with in-memory caching.
 */
async function fetchKitchenToolsFromDB(
  supabase: SupabaseClient,
): Promise<KitchenToolRow[] | null> {
  let allItems = kitchenToolsCache;
  const cacheAge = Date.now() - kitchenToolsCacheTimestamp;

  if (!allItems || cacheAge > KITCHEN_TOOLS_CACHE_TTL_MS) {
    const { data, error } = await supabase
      .from("kitchen_tools")
      .select(`id, kitchen_tool_translations ( locale, name ), image_url`)
      .limit(50);

    if (error || !data || data.length === 0) {
      console.warn(
        "[Kitchen Tools] Failed to fetch or no items available:",
        error?.message,
      );
      return null;
    }

    allItems = data as unknown as KitchenToolRow[];
    kitchenToolsCache = allItems;
    kitchenToolsCacheTimestamp = Date.now();
  }

  return allItems;
}

/**
 * Fuzzy-match an LLM tool name against a DB kitchen tool's translations.
 * Returns true if either name contains the other (case-insensitive), or if
 * they share a significant word (length > 2).
 */
export function fuzzyMatchToolName(
  llmName: string,
  dbTranslations: KitchenToolTranslationRow[],
): boolean {
  const llmLower = llmName.toLowerCase().trim();

  for (const t of dbTranslations) {
    if (!t.name) continue;
    const dbLower = t.name.toLowerCase().trim();

    // Substring match in either direction
    if (dbLower.includes(llmLower) || llmLower.includes(dbLower)) {
      return true;
    }

    // Word overlap: if LLM name shares any significant word with DB name
    const llmWords = llmLower.split(/\s+/).filter((w) => w.length > 2);
    const dbWords = dbLower.split(/\s+/).filter((w) => w.length > 2);
    for (const lw of llmWords) {
      for (const dw of dbWords) {
        if (lw === dw || dw.includes(lw) || lw.includes(dw)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Enrich LLM-generated kitchen tools with DB data (imageUrl, translated names)
 * and gap-fill Thermomix-specific accessories the LLM may not know about.
 *
 * The LLM output is treated as the primary source of truth for tool selection.
 * This function only adds images, corrects names to DB translations, and
 * appends Thermomix accessories (Varoma, butterfly whisk) when relevant.
 */
export async function enrichKitchenTools(
  supabase: SupabaseClient,
  recipe: GeneratedRecipe,
  locale: string,
  hasThermomix: boolean,
): Promise<Array<{ name: string; imageUrl?: string; notes?: string }>> {
  try {
    const llmTools = recipe.kitchenTools || [];
    const dbTools = await fetchKitchenToolsFromDB(supabase);

    // If DB is unavailable, return LLM tools as-is (they still have names + notes)
    if (!dbTools || dbTools.length === 0) {
      console.warn(
        "[Kitchen Tools] No DB tools available, using LLM output as-is",
      );
      return llmTools.map((t) => ({
        name: t.name,
        notes: t.notes || undefined,
      }));
    }

    const localeChain = buildLocaleChain(locale);

    // Build searchable recipe text for step-validation later
    const recipeStepsText = recipe.steps
      .map((s) => s.instruction)
      .join(" ")
      .toLowerCase();

    // 0. Pre-process: normalize names, split "X or Y" entries
    const preprocessed: Array<{ name: string; notes?: string | null }> = [];
    for (const llmTool of llmTools) {
      // Normalize: replace underscores with spaces, then title case
      const normalized = llmTool.name
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      // Handle "X or Y" entries: try each side against DB, use whichever matches
      if (/\bor\b/i.test(normalized)) {
        const sides = normalized.split(/\s+or\s+/i).map((s) => s.trim());
        let matched = false;
        for (const side of sides) {
          const sideMatch = dbTools.find((dbTool) =>
            fuzzyMatchToolName(
              side,
              dbTool.kitchen_tool_translations || [],
            )
          );
          if (sideMatch) {
            preprocessed.push({ name: side, notes: llmTool.notes });
            matched = true;
            break;
          }
        }
        // If neither side matches DB, drop the entry entirely
        if (!matched) {
          console.log(
            `[Kitchen Tools] Dropped "or" entry with no DB match: "${llmTool.name}"`,
          );
        }
      } else {
        preprocessed.push({ name: normalized, notes: llmTool.notes });
      }
    }

    // 1. Enrich each preprocessed tool by matching against DB for imageUrl and translated name
    const enrichedTools: Array<{
      name: string;
      imageUrl?: string;
      notes?: string;
      _dbMatched?: boolean;
    }> = [];
    for (const llmTool of preprocessed) {
      // Find best DB match via fuzzy matching
      const dbMatch = dbTools.find((dbTool) =>
        fuzzyMatchToolName(
          llmTool.name,
          dbTool.kitchen_tool_translations || [],
        )
      );

      if (dbMatch) {
        // Use locale-appropriate translated name from DB
        const translation = pickTranslation(
          dbMatch.kitchen_tool_translations || [],
          localeChain,
        );
        enrichedTools.push({
          name: translation?.name || llmTool.name,
          imageUrl: dbMatch.image_url || undefined,
          notes: llmTool.notes || undefined,
          _dbMatched: true,
        });
      } else {
        // No DB match — check if any step actually mentions this tool
        const mentionedInSteps = recipeStepsText.includes(
          llmTool.name.toLowerCase(),
        );
        if (mentionedInSteps) {
          // Keep it — steps reference it, likely a catalog gap
          enrichedTools.push({
            name: llmTool.name,
            notes: llmTool.notes || undefined,
            _dbMatched: false,
          });
          console.log(
            `[Kitchen Tools] Catalog gap candidate (in steps, no DB match): "${llmTool.name}"`,
          );
        } else {
          // Not in DB and not in steps — drop it
          console.log(
            `[Kitchen Tools] Dropped (no DB match, not in steps): "${llmTool.name}"`,
          );
        }
      }
    }

    // 2. Gap-fill: add Thermomix accessories if relevant and not already present
    if (hasThermomix) {
      const recipeText = (
        recipe.suggestedName +
        " " +
        recipe.steps.map((s) => s.instruction).join(" ")
      ).toLowerCase();

      const existingNamesLower = new Set(
        enrichedTools.map((t) => t.name.toLowerCase()),
      );

      // Check for Varoma (steaming)
      const usesVaroma = recipeText.includes("steam") ||
        recipeText.includes("varoma") || recipeText.includes("vapor") ||
        recipeText.includes("al vapor");
      if (usesVaroma) {
        const varomaDb = dbTools.find((dbTool) => {
          const names = (dbTool.kitchen_tool_translations || [])
            .map((t) => t.name?.toLowerCase() || "")
            .join(" ");
          return names.includes("varoma");
        });
        if (varomaDb) {
          const translation = pickTranslation(
            varomaDb.kitchen_tool_translations || [],
            localeChain,
          );
          const varomaName = translation?.name || "Varoma";
          if (!existingNamesLower.has(varomaName.toLowerCase())) {
            enrichedTools.push({
              name: varomaName,
              imageUrl: varomaDb.image_url || undefined,
            });
            existingNamesLower.add(varomaName.toLowerCase());
          }
        }
      }

      // Check for butterfly whisk (whipping/creaming)
      const usesButterfly = recipeText.includes("whip") ||
        recipeText.includes("cream") || recipeText.includes("batir") ||
        recipeText.includes("montar") || recipeText.includes("butterfly") ||
        recipeText.includes("mariposa");
      if (usesButterfly) {
        const butterflyDb = dbTools.find((dbTool) => {
          const names = (dbTool.kitchen_tool_translations || [])
            .map((t) => t.name?.toLowerCase() || "")
            .join(" ");
          return names.includes("butterfly") || names.includes("mariposa");
        });
        if (butterflyDb) {
          const translation = pickTranslation(
            butterflyDb.kitchen_tool_translations || [],
            localeChain,
          );
          const butterflyName = translation?.name || "Butterfly Whisk";
          if (!existingNamesLower.has(butterflyName.toLowerCase())) {
            enrichedTools.push({
              name: butterflyName,
              imageUrl: butterflyDb.image_url || undefined,
            });
            existingNamesLower.add(butterflyName.toLowerCase());
          }
        }
      }
    }

    // 3. Deduplicate by name (case-insensitive), keeping the first occurrence
    const seen = new Set<string>();
    const deduped = enrichedTools.filter((tool) => {
      const key = tool.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 4. Sanity cap at 8 tools, strip internal metadata
    const result = deduped.slice(0, 8).map(({ _dbMatched, ...tool }) => tool);

    console.log(
      "[Kitchen Tools] Enriched tools:",
      result.map((t) => t.name),
    );
    return result;
  } catch (error) {
    console.error("[Kitchen Tools] Error enriching kitchen tools:", error);
    // Fallback: return LLM tools without enrichment
    return (recipe.kitchenTools || []).map((t) => ({
      name: t.name,
      notes: t.notes || undefined,
    }));
  }
}
