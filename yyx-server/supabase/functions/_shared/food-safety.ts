/**
 * Food Safety Validation
 *
 * Validates generated recipes against food safety rules from the database.
 * Checks cooking times and temperatures for safety-critical ingredients.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { normalizeIngredient } from "./ingredient-normalization.ts";

// ============================================================
// Types
// ============================================================

export interface FoodSafetyRule {
  ingredient_canonical: string;
  category: string;
  min_temp_c: number;
  min_temp_f: number;
  min_cook_min: number;
}

export interface SafetyCheckResult {
  safe: boolean;
  warnings: string[];
}

export interface GeneratedRecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
}

// ============================================================
// Cache
// ============================================================

let safetyRulesCache: FoodSafetyRule[] | null = null;
let loadingPromise: Promise<FoodSafetyRule[]> | null = null;

// Pre-compiled regex patterns for each rule (performance optimization)
let rulePatternCache: Map<string, RegExp> | null = null;

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Get or create the pre-compiled regex pattern for a rule.
 */
function getRulePattern(ruleCanonical: string): RegExp {
  if (!rulePatternCache) {
    rulePatternCache = new Map();
  }

  let pattern = rulePatternCache.get(ruleCanonical);
  if (!pattern) {
    pattern = new RegExp(`\\b${escapeRegex(ruleCanonical)}\\b`, "i");
    rulePatternCache.set(ruleCanonical, pattern);
  }
  return pattern;
}

/**
 * Load food safety rules from database.
 * Caches indefinitely - rules are USDA guidelines that rarely change.
 * Cache clears on function restart (deploys) or via clearFoodSafetyCache().
 */
export async function loadFoodSafetyRules(
  supabase: SupabaseClient,
): Promise<FoodSafetyRule[]> {
  if (safetyRulesCache) {
    return safetyRulesCache;
  }

  // Prevent duplicate concurrent DB fetches
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    const { data, error } = await supabase
      .from("food_safety_rules")
      .select(
        "ingredient_canonical, category, min_temp_c, min_temp_f, min_cook_min",
      );

    if (error) {
      console.error("Failed to load food safety rules:", error);
      loadingPromise = null;
      return [];
    }

    safetyRulesCache = data as FoodSafetyRule[];
    loadingPromise = null;

    // Pre-compile regex patterns for all rules
    rulePatternCache = new Map();
    for (const rule of safetyRulesCache) {
      rulePatternCache.set(
        rule.ingredient_canonical,
        new RegExp(`\\b${escapeRegex(rule.ingredient_canonical)}\\b`, "i"),
      );
    }

    console.log(`Loaded ${safetyRulesCache.length} food safety rules`);
    return safetyRulesCache;
  })();

  return loadingPromise;
}

/**
 * Clear food safety rules cache (for testing).
 */
export function clearFoodSafetyCache(): void {
  safetyRulesCache = null;
  loadingPromise = null;
  rulePatternCache = null;
}

// ============================================================
// Safety Checking
// ============================================================

/**
 * Check a generated recipe for food safety concerns.
 *
 * Returns warnings if:
 * - Total cook time is less than minimum safe time for any ingredient
 * - Recipe includes safety-critical ingredients
 *
 * @param supabase - Supabase client
 * @param ingredients - Recipe ingredients to check
 * @param totalTime - Total recipe time in minutes
 * @param measurementSystem - User's preferred measurement system
 * @param language - User's language for warning messages
 */
export async function checkRecipeSafety(
  supabase: SupabaseClient,
  ingredients: GeneratedRecipeIngredient[],
  totalTime: number,
  measurementSystem: "imperial" | "metric",
  language: "en" | "es",
): Promise<SafetyCheckResult> {
  const rules = await loadFoodSafetyRules(supabase);
  if (rules.length === 0) {
    // No rules loaded, assume safe (don't block on missing data)
    return { safe: true, warnings: [] };
  }

  const warnings: string[] = [];
  const matchedRules: Map<string, FoodSafetyRule> = new Map();

  // Normalize ingredients and find matching safety rules
  for (const ingredient of ingredients) {
    const normalized = await normalizeIngredient(
      supabase,
      ingredient.name,
      language,
    );

    // Check for exact match or partial match (ingredient contains safety item)
    for (const rule of rules) {
      // Direct match with canonical name
      if (normalized === rule.ingredient_canonical) {
        matchedRules.set(rule.ingredient_canonical, rule);
        continue;
      }

      // Check if ingredient contains the safety-critical item
      // (e.g., "chicken breast" contains "chicken")
      // Use pre-compiled word boundary pattern to avoid false positives
      const rulePattern = getRulePattern(rule.ingredient_canonical);
      if (rulePattern.test(normalized)) {
        matchedRules.set(rule.ingredient_canonical, rule);
      }
    }
  }

  // Check cook time against minimum safe times
  for (const [ingredientName, rule] of matchedRules) {
    if (totalTime < rule.min_cook_min) {
      const tempStr =
        measurementSystem === "imperial"
          ? `${rule.min_temp_f}°F`
          : `${rule.min_temp_c}°C`;

      const warning =
        language === "es"
          ? `${formatIngredientName(ingredientName)} requiere al menos ${rule.min_cook_min} minutos de cocción y una temperatura interna de ${tempStr}.`
          : `${formatIngredientName(ingredientName)} requires at least ${rule.min_cook_min} minutes of cooking and an internal temperature of ${tempStr}.`;

      warnings.push(warning);
    }
  }

  return {
    safe: warnings.length === 0,
    warnings,
  };
}

/**
 * Get recommended internal temperature for an ingredient.
 */
export async function getRecommendedTemp(
  supabase: SupabaseClient,
  ingredientName: string,
  measurementSystem: "imperial" | "metric",
  language: "en" | "es",
): Promise<string | null> {
  const rules = await loadFoodSafetyRules(supabase);
  const normalized = await normalizeIngredient(
    supabase,
    ingredientName,
    language,
  );

  for (const rule of rules) {
    if (ingredientMatchesRule(normalized, rule.ingredient_canonical)) {
      return measurementSystem === "imperial"
        ? `${rule.min_temp_f}°F`
        : `${rule.min_temp_c}°C`;
    }
  }

  return null;
}

/**
 * Build safety reminder text to include in recipe generation prompt.
 */
export async function buildSafetyReminders(
  supabase: SupabaseClient,
  ingredients: string[],
  measurementSystem: "imperial" | "metric",
): Promise<string> {
  const rules = await loadFoodSafetyRules(supabase);
  if (rules.length === 0) return "";

  const reminders: string[] = [];

  for (const ingredient of ingredients) {
    const lowerIngredient = ingredient.toLowerCase();

    for (const rule of rules) {
      // Use word boundary matching to avoid false positives
      if (ingredientMatchesRule(lowerIngredient, rule.ingredient_canonical)) {
        const temp =
          measurementSystem === "imperial"
            ? `${rule.min_temp_f}°F`
            : `${rule.min_temp_c}°C`;

        reminders.push(
          `${formatIngredientName(rule.ingredient_canonical)} must reach internal temp of ${temp}`,
        );
        break;
      }
    }
  }

  if (reminders.length === 0) return "";

  return `FOOD SAFETY REQUIREMENTS:\n${reminders.join("\n")}`;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Check if an ingredient matches a safety rule using pre-compiled patterns.
 */
function ingredientMatchesRule(
  ingredient: string,
  ruleCanonical: string,
): boolean {
  if (ingredient === ruleCanonical) return true;
  const pattern = getRulePattern(ruleCanonical);
  return pattern.test(ingredient);
}

/**
 * Format ingredient name for display (capitalize, replace underscores).
 */
function formatIngredientName(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
