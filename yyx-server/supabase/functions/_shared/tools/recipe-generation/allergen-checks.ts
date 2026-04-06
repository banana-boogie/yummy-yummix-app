/**
 * Allergen checking and prompt building for recipe generation.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  checkIngredientForAllergens,
  getAllergenWarning,
  loadAllergenGroups,
} from "../../allergen-filter.ts";
import { getBaseLanguage } from "../../locale-utils.ts";
import type { AllergenCheckResult } from "./types.ts";

/**
 * Check all ingredients against user's allergen restrictions.
 * Uses parallel processing for performance.
 */
export async function checkIngredientsForAllergens(
  supabase: SupabaseClient,
  ingredients: string[],
  dietaryRestrictions: string[],
  customAllergies: string[],
  locale: string,
): Promise<AllergenCheckResult> {
  const allRestrictions = [...dietaryRestrictions, ...customAllergies];

  if (allRestrictions.length === 0) {
    return { safe: true };
  }

  // Check all ingredients in parallel for performance
  const results = await Promise.all(
    ingredients.map((ingredient) =>
      checkIngredientForAllergens(
        supabase,
        ingredient,
        allRestrictions,
        locale,
      )
    ),
  );

  // Find the first unsafe ingredient
  const unsafeResult = results.find((result) => !result.safe);

  if (unsafeResult) {
    const baseLang = getBaseLanguage(locale);
    if (unsafeResult.systemUnavailable) {
      const SYSTEM_UNAVAILABLE_WARNINGS: Record<string, string> = {
        es:
          "No pude verificar alergias en este momento. Para tu seguridad, no puedo generar esta receta ahora.",
        en:
          "I couldn't verify allergens right now. For your safety, I can't generate this recipe at the moment.",
      };
      return {
        safe: false,
        systemUnavailable: true,
        warning: SYSTEM_UNAVAILABLE_WARNINGS[baseLang] ||
          SYSTEM_UNAVAILABLE_WARNINGS["en"],
      };
    }

    const warning = await getAllergenWarning(
      supabase,
      unsafeResult.allergen!,
      unsafeResult.category!,
      locale,
    );
    return { safe: false, warning };
  }

  return { safe: true };
}

/**
 * Build a prompt section listing specific allergen ingredients the AI must avoid.
 * Uses the same allergen_groups DB table as the runtime checker — single source of truth.
 */
export async function buildAllergenPromptSection(
  supabase: SupabaseClient,
  restrictions: string[],
  language: "en" | "es",
): Promise<string> {
  if (restrictions.length === 0) return "";

  const allergens = await loadAllergenGroups(supabase); // cached, zero-cost after first call
  const sections: string[] = [];

  for (const restriction of restrictions) {
    const entries = allergens.filter((a) => a.category === restriction);
    if (entries.length === 0) continue;

    const names = entries.map((e) =>
      e.names[language] ?? e.names["en"] ?? e.ingredient_canonical
    );
    const header = language === "es"
      ? `**${restriction}**: NUNCA uses estos ingredientes:`
      : `**${restriction}**: NEVER use these ingredients:`;
    sections.push(`${header}\n${names.join(", ")}`);
  }

  if (sections.length === 0) return "";

  const title = language === "es"
    ? "## RESTRICCIONES DE ALERGENOS — PROHIBIDO usar estos ingredientes"
    : "## ALLERGEN RESTRICTIONS — NEVER use these ingredients";

  return `\n\n${title}\n\n${sections.join("\n\n")}`;
}
