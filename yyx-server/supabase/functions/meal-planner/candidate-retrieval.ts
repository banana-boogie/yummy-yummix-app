/**
 * Candidate Retrieval
 *
 * SQL prefilter for each cookable slot:
 *   - is_published = true (the quality gate per §3)
 *   - has planner_role + food_groups
 *   - planner_role compatible with canonical meal type
 *   - dietary_restrictions → allergen exclusion (filtered at scoring time
 *     since allergen data lives on ingredient rows; here we annotate)
 *   - top N per slot (30 for cook, 10 for no-cook fallback)
 *
 * Spec: ranking-algorithm-detail.md §3
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { MealSlot } from "./slot-classifier.ts";
import { MEAL_TYPE_PRIMARY_ROLES, RETRIEVAL_LIMITS } from "./scoring-config.ts";
import type { CanonicalMealType } from "./types.ts";

export interface RecipeCandidate {
  id: string;
  title: string;
  plannerRole: string;
  foodGroups: string[];
  isComplete: boolean;
  totalTimeMinutes: number | null;
  difficulty: "easy" | "medium" | "hard" | null;
  portions: number | null;
  imageUrl: string | null;
  leftoversFriendly: boolean;
  batchFriendly: boolean | null;
  maxHouseholdSizeSupported: number | null;
  equipmentTags: string[];
  cookingLevel: "beginner" | "intermediate" | "experienced" | null;
  verifiedAt: string | null;
  isPublished: boolean;
  ingredientIds: string[];
  ingredientKeys: string[]; // canonical ingredient names for overlap checks
  cuisineTags: string[];
  // Allergen annotation per user context (populated post-fetch).
  hasAllergenConflict: boolean;
  allergenMatches: string[];
}

export interface CandidateMap {
  cook: Map<string, RecipeCandidate[]>;
  fallback: Map<string, RecipeCandidate[]>;
}

export interface CandidateRetrievalContext {
  supabase: SupabaseClient;
  locale: string;
  localeChain: string[];
  dietaryRestrictions: string[];
  hardExcludedRecipeIds: Set<string>; // rating ≤ 2 etc.
}

interface RawRecipeRow {
  id: string;
  planner_role: string | null;
  food_groups: string[] | null;
  is_complete_meal: boolean | null;
  total_time: number | null;
  difficulty: "easy" | "medium" | "hard" | null;
  portions: number | null;
  image_url: string | null;
  leftovers_friendly: boolean | null;
  batch_friendly: boolean | null;
  max_household_size_supported: number | null;
  equipment_tags: string[] | null;
  cooking_level: "beginner" | "intermediate" | "experienced" | null;
  verified_at: string | null;
  is_published: boolean | null;
  recipe_translations: Array<{ locale: string; name: string | null }> | null;
  recipe_ingredients:
    | Array<{
      ingredient_id: string | null;
      ingredients: {
        id: string;
        ingredient_translations: Array<{ locale: string; name: string | null }>;
      } | null;
    }>
    | null;
  recipe_to_tag:
    | Array<{
      recipe_tags: {
        categories: string[] | null;
        recipe_tag_translations: Array<{ locale: string; name: string | null }>;
      } | null;
    }>
    | null;
}

/**
 * Resolve a translation name using the locale fallback chain. Returns an empty
 * string when no chain entry matches — no cross-language fallback. Callers
 * must handle empty titles (usually by dropping the candidate).
 */
export function pickTranslationName(
  translations: Array<{ locale: string; name: string | null }> | null,
  localeChain: string[],
): string {
  if (!translations?.length) return "";
  for (const l of localeChain) {
    const row = translations.find((t) => t.locale === l);
    if (row?.name) return row.name;
  }
  return "";
}

export function normalizeKey(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function toCandidate(
  row: RawRecipeRow,
  ctx: CandidateRetrievalContext,
): RecipeCandidate {
  const ingredientIds: string[] = [];
  const ingredientKeys: string[] = [];
  for (const ri of row.recipe_ingredients ?? []) {
    const ing = ri.ingredients;
    if (!ing) continue;
    ingredientIds.push(ing.id);
    const name = pickTranslationName(
      ing.ingredient_translations ?? [],
      ctx.localeChain,
    );
    if (name) ingredientKeys.push(normalizeKey(name));
  }

  const cuisineTags: string[] = [];
  for (const rt of row.recipe_to_tag ?? []) {
    const tag = rt.recipe_tags;
    if (!tag) continue;
    if (!tag.categories?.includes("CULTURAL_CUISINE")) continue;
    const name = pickTranslationName(
      tag.recipe_tag_translations ?? [],
      ctx.localeChain,
    );
    if (name) cuisineTags.push(name.toLowerCase());
  }

  return {
    id: row.id,
    title: pickTranslationName(row.recipe_translations, ctx.localeChain),
    plannerRole: row.planner_role ?? "",
    foodGroups: row.food_groups ?? [],
    isComplete: !!row.is_complete_meal,
    totalTimeMinutes: row.total_time,
    difficulty: row.difficulty,
    portions: row.portions,
    imageUrl: row.image_url,
    leftoversFriendly: !!row.leftovers_friendly,
    batchFriendly: row.batch_friendly,
    maxHouseholdSizeSupported: row.max_household_size_supported,
    equipmentTags: row.equipment_tags ?? [],
    cookingLevel: row.cooking_level,
    verifiedAt: row.verified_at,
    isPublished: !!row.is_published,
    ingredientIds,
    ingredientKeys,
    cuisineTags,
    hasAllergenConflict: false,
    allergenMatches: [],
  };
}

/**
 * Fetch all candidates for this request's distinct canonical meal types.
 * We fetch once per canonical meal type, then slice per slot.
 */
export async function fetchCandidates(
  slots: MealSlot[],
  ctx: CandidateRetrievalContext,
): Promise<CandidateMap> {
  const distinctMealTypes = new Set<CanonicalMealType>(
    slots.map((s) => s.canonicalMealType),
  );

  // Union of planner_roles needed across all requested meal types.
  const neededRoles = new Set<string>();
  for (const mt of distinctMealTypes) {
    for (const role of MEAL_TYPE_PRIMARY_ROLES[mt]) {
      neededRoles.add(role);
    }
  }

  if (neededRoles.size === 0) {
    return { cook: new Map(), fallback: new Map() };
  }

  const selectFields = `
    id,
    planner_role,
    food_groups,
    is_complete_meal,
    total_time,
    difficulty,
    portions,
    image_url,
    leftovers_friendly,
    batch_friendly,
    max_household_size_supported,
    equipment_tags,
    cooking_level,
    verified_at,
    is_published,
    recipe_translations ( locale, name ),
    recipe_ingredients ( ingredient_id, ingredients ( id, ingredient_translations ( locale, name ) ) ),
    recipe_to_tag ( recipe_tags ( categories, recipe_tag_translations ( locale, name ) ) )
  `;

  const { data, error } = await ctx.supabase
    .from("recipes")
    .select(selectFields)
    .eq("is_published", true)
    .not("planner_role", "is", null)
    .in("planner_role", [...neededRoles])
    // food_groups must have at least one value to qualify as planner-ready.
    .not("food_groups", "eq", "{}");

  if (error) {
    throw new Error(`Candidate fetch failed: ${error.message}`);
  }

  const rawRows = (data ?? []) as unknown as RawRecipeRow[];
  const hydrated = rawRows
    .filter((r) => (r.food_groups?.length ?? 0) > 0)
    .filter((r) => !ctx.hardExcludedRecipeIds.has(r.id))
    .map((r) => toCandidate(r, ctx));

  // Drop candidates with no translation in the requested locale chain. We do
  // not cross-language fallback — a Spanish user should never see an English
  // recipe name and vice versa. Missing translations are logged so the content
  // team can close the gap.
  const candidates: RecipeCandidate[] = [];
  let droppedForLocale = 0;
  for (const c of hydrated) {
    if (!c.title || c.title.length === 0) {
      droppedForLocale++;
      continue;
    }
    candidates.push(c);
  }
  if (droppedForLocale > 0) {
    console.warn(
      `[candidate-retrieval] Dropped ${droppedForLocale} candidate(s) missing translation for locale=${ctx.locale}`,
    );
  }

  return splitCandidatesBySlot(slots, candidates);
}

/**
 * Given all fetched candidates, partition into:
 *   - cook: per-slot top N (candidates compatible with the slot's meal-type roles)
 *   - fallback: per-slot top N for no-cook
 */
function splitCandidatesBySlot(
  slots: MealSlot[],
  candidates: RecipeCandidate[],
): CandidateMap {
  const cook = new Map<string, RecipeCandidate[]>();
  const fallback = new Map<string, RecipeCandidate[]>();

  for (const slot of slots) {
    const allowedRoles = MEAL_TYPE_PRIMARY_ROLES[slot.canonicalMealType];
    const compatible = candidates.filter((c) =>
      allowedRoles.includes(c.plannerRole)
    );

    const isFallbackSlot = slot.slotKind === "no_cook_fallback_slot";
    const cap = isFallbackSlot
      ? RETRIEVAL_LIMITS.noCookFallbackTopN
      : RETRIEVAL_LIMITS.cookSlotTopN;

    if (isFallbackSlot) {
      // no-cook fallback: prefer shorter recipes, snack/dessert roles, or
      // leftovers_friendly recipes. Time-first sort; scoring refines further.
      const sorted = compatible
        .slice()
        .sort((a, b) =>
          (a.totalTimeMinutes ?? 9999) - (b.totalTimeMinutes ?? 9999)
        )
        .slice(0, cap);
      fallback.set(slot.slotId, sorted);
      // Also populate cook in case of partial plan rescue.
      cook.set(slot.slotId, sorted);
    } else {
      // Cookable slots: return all compatible up to cap. Scoring handles ranking.
      // Slicing by a deterministic key keeps tests stable; sort by id.
      const sorted = compatible
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, cap);
      cook.set(slot.slotId, sorted);
    }
  }

  return { cook, fallback };
}

/**
 * Total unique candidates across the map — used for thin-catalog checks.
 */
export function countUniqueCandidates(map: CandidateMap): number {
  const ids = new Set<string>();
  for (const arr of map.cook.values()) {
    for (const c of arr) ids.add(c.id);
  }
  for (const arr of map.fallback.values()) {
    for (const c of arr) ids.add(c.id);
  }
  return ids.size;
}

/**
 * Hydrate recipe IDs that must be excluded hard — rating ≤ 2 from user history.
 *
 * No recipe_ratings table exists yet (PR #8). For now this scans user_events
 * for 'rate_recipe' events with a payload rating ≤ HISTORY.hardRejectionRating.
 * Returns an empty set if the query fails — hard exclusions are a best-effort
 * filter, not a correctness requirement.
 */
export async function loadHardExcludedRecipeIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const excluded = new Set<string>();
  try {
    const { data, error } = await supabase
      .from("user_events")
      .select("payload")
      .eq("user_id", userId)
      .eq("event_type", "rate_recipe");
    if (error || !data) return excluded;
    for (const row of data as Array<{ payload: Record<string, unknown> }>) {
      const payload = row.payload ?? {};
      const rating = payload?.rating;
      const recipeId = payload?.recipe_id;
      if (
        typeof rating === "number" && rating <= 2 &&
        typeof recipeId === "string" && recipeId.length > 0
      ) {
        excluded.add(recipeId);
      }
    }
  } catch {
    // swallow — this is an optional filter
  }
  return excluded;
}

/**
 * Load recent cook history for the user (last 3 weeks) → used for
 * recentRecipePenalty in the variety factor.
 */
export async function loadRecentCookedRecipeIds(
  supabase: SupabaseClient,
  userId: string,
  sinceDaysAgo = 21,
): Promise<Map<string, Date>> {
  const cutoff = new Date(Date.now() - sinceDaysAgo * 86_400_000).toISOString();
  const map = new Map<string, Date>();
  try {
    const { data, error } = await supabase
      .from("user_events")
      .select("payload, created_at")
      .eq("user_id", userId)
      .eq("event_type", "cook_complete")
      .gte("created_at", cutoff);
    if (error || !data) return map;
    for (
      const row of data as Array<{
        payload: Record<string, unknown>;
        created_at: string;
      }>
    ) {
      const recipeId = row.payload?.recipe_id;
      if (typeof recipeId === "string" && recipeId.length > 0) {
        const existing = map.get(recipeId);
        const when = new Date(row.created_at);
        if (!existing || when > existing) map.set(recipeId, when);
      }
    }
  } catch {
    // swallow
  }
  return map;
}
