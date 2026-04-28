/**
 * Candidate Retrieval
 *
 * SQL + JS prefilter for each cookable slot:
 *   - is_published = true (the quality gate per §3)
 *   - has planner_role
 *   - planner_role compatible with canonical meal type's primary roles
 *   - MEAL_TYPE tag compatible with canonical meal type
 *   - dietary_restrictions → allergen exclusion (filtered at scoring time
 *     since allergen data lives on ingredient rows; here we annotate)
 *   - top N per slot (30)
 *
 * Spec: ranking-algorithm-detail.md §3
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { MealSlot } from "./slot-classifier.ts";
import {
  MEAL_TYPE_PRIMARY_ROLES,
  RETRIEVAL_LIMITS,
  SHORTLIST_SCORES,
} from "./scoring-config.ts";
import type { CanonicalMealType } from "./types.ts";
import { normalizeIngredients } from "../_shared/ingredient-normalization.ts";
import { toCanonicalMealType } from "./meal-types.ts";

export interface RecipeCandidate {
  id: string;
  title: string;
  /**
   * Default planner role from the recipe's `planner_role` column.
   * Drives default scheduling and content-health bucketing. Pantry-role
   * recipes are filtered out at retrieval — never seen here.
   */
  plannerRole: string;
  /**
   * Optional secondary slot-types this recipe is also eligible for, from
   * `recipes.alternate_planner_roles`. Empty for most recipes.
   * Example: hummus has `plannerRole='side'`, `alternatePlannerRoles=['snack']`.
   * The CHECK constraint forbids `'pantry'` here.
   */
  alternatePlannerRoles: string[];
  mealComponents: string[];
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
  mealTypeTags: CanonicalMealType[];
  // Allergen annotation per user context (populated post-fetch).
  hasAllergenConflict: boolean;
  allergenMatches: string[];
  /**
   * Explicit-dislike annotation per user context (populated post-fetch).
   * Candidates with `hasDislikeConflict=true` are hard-rejected during
   * scoring alongside allergen conflicts.
   */
  hasDislikeConflict: boolean;
  dislikeMatches: string[];
}

/**
 * Per-slot top-N candidates, keyed by slotId. Every slot kind — cook_slot,
 * leftover_target_slot, weekend_flexible_slot — draws from the same pool;
 * busy-day ranking bias lives in the scoring layer, not a separate candidate
 * path.
 */
export type CandidateMap = Map<string, RecipeCandidate[]>;

export interface CandidateRetrievalContext {
  supabase: SupabaseClient;
  locale: string;
  localeChain: string[];
  dietaryRestrictions: string[];
  ingredientDislikes: string[];
  hardExcludedRecipeIds: Set<string>; // rating ≤ 2 etc.
  warnings?: string[];
}

interface RawRecipeRow {
  id: string;
  planner_role: string | null;
  alternate_planner_roles: string[] | null;
  meal_components: string[] | null;
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
  canonicalByRawName: Map<string, string>,
): RecipeCandidate {
  const ingredientIds: string[] = [];
  const ingredientKeys: string[] = [];
  for (const ri of row.recipe_ingredients ?? []) {
    const ing = ri.ingredients;
    if (!ing) continue;
    ingredientIds.push(ing.id);
    // Pick the locale-chain translation for display, then resolve it to a
    // canonical English key via the alias system. This is the key fix for
    // the locale-keyed-ingredient bug: without canonicalization, an es user's
    // `pollo` would never match the canonical `chicken` allergen and the
    // hard-reject filter would silently miss.
    const name = pickTranslationName(
      ing.ingredient_translations ?? [],
      ctx.localeChain,
    );
    if (!name) continue;
    const canonical = canonicalByRawName.get(name) ?? name;
    ingredientKeys.push(normalizeKey(canonical));
  }

  const cuisineTags: string[] = [];
  const mealTypeTags = new Set<CanonicalMealType>();
  for (const rt of row.recipe_to_tag ?? []) {
    const tag = rt.recipe_tags;
    if (!tag) continue;
    if (tag.categories?.includes("cuisine")) {
      const name = pickTranslationName(
        tag.recipe_tag_translations ?? [],
        ctx.localeChain,
      );
      if (name) cuisineTags.push(name.toLowerCase());
    }
    if (tag.categories?.includes("meal_type")) {
      for (const translation of tag.recipe_tag_translations ?? []) {
        if (!translation.name) continue;
        try {
          mealTypeTags.add(toCanonicalMealType(translation.name));
        } catch {
          // Ignore non-canonical legacy names that happen to carry meal_type.
        }
      }
    }
  }

  return {
    id: row.id,
    title: pickTranslationName(row.recipe_translations, ctx.localeChain),
    plannerRole: row.planner_role ?? "",
    alternatePlannerRoles: row.alternate_planner_roles ?? [],
    mealComponents: row.meal_components ?? [],
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
    cuisineTags: cuisineTags.sort((a, b) => a.localeCompare(b)),
    mealTypeTags: [...mealTypeTags],
    hasAllergenConflict: false,
    allergenMatches: [],
    hasDislikeConflict: false,
    dislikeMatches: [],
  };
}

function normalizedDifficulty(
  candidate: RecipeCandidate,
): "easy" | "medium" | "hard" {
  const level = candidate.cookingLevel ?? candidate.difficulty;
  if (level === "easy" || level === "beginner") return "easy";
  if (level === "hard" || level === "experienced") return "hard";
  return "medium";
}

function shortlistTimeScore(
  slot: MealSlot,
  candidate: RecipeCandidate,
): number {
  const total = candidate.totalTimeMinutes;
  const t = SHORTLIST_SCORES.time;
  if (!total || total <= 0) {
    return slot.slotKind === "weekend_flexible_slot"
      ? t.weekend.missing
      : t.weeknight.missing;
  }

  if (slot.slotKind === "weekend_flexible_slot") {
    if (total <= 120) return t.weekend.under120;
    if (total <= 180) return t.weekend.under180;
    if (total <= 240) return t.weekend.under240;
    return t.weekend.over;
  }

  if (slot.isBusyDay) {
    if (total <= 30) return t.busyDay.under30;
    if (total <= 45) return t.busyDay.under45;
    if (total <= 60) return t.busyDay.under60;
    return t.busyDay.over;
  }

  if (total <= 45) return t.weeknight.under45;
  if (total <= 60) return t.weeknight.under60;
  if (total <= 75) return t.weeknight.under75;
  return t.weeknight.over;
}

function shortlistDifficultyScore(
  slot: MealSlot,
  candidate: RecipeCandidate,
): number {
  const level = normalizedDifficulty(candidate);
  const d = SHORTLIST_SCORES.difficulty;
  if (slot.slotKind === "weekend_flexible_slot") return d.weekend[level];
  if (slot.isBusyDay) return d.busyDay[level];
  return d.weeknight[level];
}

function shortlistSourceScore(
  slot: MealSlot,
  candidate: RecipeCandidate,
): number {
  if (!slot.feedsFutureLeftoverTarget) return 0;

  const s = SHORTLIST_SCORES.source;
  let score = candidate.leftoversFriendly ? s.leftoversFriendly : 0;
  if (candidate.batchFriendly) score += s.batchFriendly;
  if (candidate.portions && candidate.portions > 0) {
    score += Math.min(candidate.portions, s.portionsCap);
  }
  return score;
}

function shortlistScore(slot: MealSlot, candidate: RecipeCandidate): number {
  const f = SHORTLIST_SCORES.flags;
  let score = 0;
  score += shortlistSourceScore(slot, candidate);
  score += shortlistTimeScore(slot, candidate);
  score += shortlistDifficultyScore(slot, candidate);
  if (candidate.verifiedAt) score += f.verified;
  if (candidate.isComplete) score += f.completeMeal;
  if (candidate.leftoversFriendly && !slot.feedsFutureLeftoverTarget) {
    score += f.leftoversFriendlyBonusWhenNotFeedingLeftover;
  }
  return score;
}

function compareCandidateTimes(
  a: RecipeCandidate,
  b: RecipeCandidate,
): number {
  const timeA = a.totalTimeMinutes ?? Number.POSITIVE_INFINITY;
  const timeB = b.totalTimeMinutes ?? Number.POSITIVE_INFINITY;
  return timeA - timeB;
}

export function shortlistCandidatesForSlot(
  slot: MealSlot,
  candidates: RecipeCandidate[],
): RecipeCandidate[] {
  return candidates
    .slice()
    .sort((a, b) => {
      const scoreDelta = shortlistScore(slot, b) - shortlistScore(slot, a);
      if (scoreDelta !== 0) return scoreDelta;

      const verifiedDelta = Number(!!b.verifiedAt) - Number(!!a.verifiedAt);
      if (verifiedDelta !== 0) return verifiedDelta;

      const completenessDelta = Number(b.isComplete) - Number(a.isComplete);
      if (completenessDelta !== 0) return completenessDelta;

      const timeDelta = compareCandidateTimes(a, b);
      if (timeDelta !== 0) return timeDelta;

      const titleDelta = a.title.localeCompare(b.title);
      if (titleDelta !== 0) return titleDelta;

      return a.id.localeCompare(b.id);
    })
    .slice(0, RETRIEVAL_LIMITS.cookSlotTopN);
}

/**
 * Roles that require non-empty `meal_components` per recipe-role-model.md §6.1
 * and its accepted 2026-04-17 amendment. Only main-role recipes are required
 * to declare meal_components; sides may be empty when their contribution is
 * contextual or not one of protein/carb/veg.
 */
const ROLES_REQUIRING_MEAL_COMPONENTS: ReadonlySet<string> = new Set([
  "main",
]);

function isRoleEligibleForAnySlot(
  row: RawRecipeRow,
  neededRoles: ReadonlySet<string>,
): boolean {
  if (neededRoles.size === 0) return false;
  if (row.planner_role && neededRoles.has(row.planner_role)) return true;
  for (const alt of row.alternate_planner_roles ?? []) {
    if (neededRoles.has(alt)) return true;
  }
  return false;
}

/**
 * meal_components is mandatory whenever the recipe could fill a main
 * slot — through its primary `planner_role` OR through any
 * `alternate_planner_roles` entry. Without this rule, a `planner_role='snack'`
 * recipe with `alternate_planner_roles=['main']` and empty `meal_components`
 * would pass the gate (snack doesn't need meal_components), get matched into
 * a dinner slot via its alternate role, and silently break coverage.
 *
 * Exported for direct unit testing.
 */
export function satisfiesRoleConditionalMealComponents(
  row: Pick<
    RawRecipeRow,
    "planner_role" | "alternate_planner_roles" | "meal_components"
  >,
): boolean {
  if (!row.planner_role) return false;
  const allRoles = [row.planner_role, ...(row.alternate_planner_roles ?? [])];
  const requiresComponents = allRoles.some((r) =>
    ROLES_REQUIRING_MEAL_COMPONENTS.has(r)
  );
  if (!requiresComponents) return true;
  return (row.meal_components?.length ?? 0) > 0;
}

/**
 * Walk a batch of recipe rows, collect the unique locale-chain ingredient
 * names, and resolve them to canonical English keys via the alias system.
 * Returns a Map<rawName, canonicalName> that callers use to convert
 * `ingredientKeys` to canonical form before allergen/dislike matching.
 *
 * The alias map is loaded once and cached inside `_shared/ingredient-
 * normalization.ts` (see `loadAliases`), so repeat calls in the same edge
 * invocation are cheap. Most-specific locale in the chain drives lookup —
 * the helper itself walks `es-MX → es → en` fallbacks via `getBaseLanguage`.
 */
interface IngredientHydrationRow {
  recipe_ingredients?:
    | Array<{
      ingredients?:
        | {
          ingredient_translations?:
            | Array<{ locale: string; name: string | null }>
            | null;
        }
        | null;
    }>
    | null;
}

export async function buildCanonicalIngredientMap(
  supabase: SupabaseClient,
  rows: ReadonlyArray<IngredientHydrationRow>,
  localeChain: string[],
): Promise<Map<string, string>> {
  const rawNames = new Set<string>();
  for (const row of rows) {
    for (const ri of row.recipe_ingredients ?? []) {
      const ing = ri.ingredients;
      if (!ing) continue;
      const name = pickTranslationName(
        ing.ingredient_translations ?? [],
        localeChain,
      );
      if (name) rawNames.add(name);
    }
  }
  if (rawNames.size === 0) return new Map();

  const namesArr = [...rawNames];
  const locale = localeChain[0] ?? "en";
  const canonicals = await normalizeIngredients(supabase, namesArr, locale);

  const map = new Map<string, string>();
  for (let i = 0; i < namesArr.length; i++) {
    map.set(namesArr[i], canonicals[i] ?? namesArr[i]);
  }
  return map;
}

/**
 * True if `candidate` matches `slot` only via its `alternate_planner_roles`
 * (its primary `plannerRole` is NOT in the meal-type's expected primary
 * roles list). Used by the scorer to apply the primary-role preference
 * penalty per recipe-role-model.md §6.3.
 */
export function isAlternateRoleMatch(
  slot: MealSlot,
  candidate: RecipeCandidate,
): boolean {
  const primaryRoles = MEAL_TYPE_PRIMARY_ROLES[slot.canonicalMealType];
  if (primaryRoles.includes(candidate.plannerRole)) return false;
  for (const alt of candidate.alternatePlannerRoles) {
    if (primaryRoles.includes(alt)) return true;
  }
  return false;
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
    return new Map();
  }
  const neededRolesList = [...neededRoles];

  const selectFields = `
    id,
    planner_role,
    alternate_planner_roles,
    meal_components,
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

  // Per recipe-role-model.md §6.1:
  //   - is_published = true (quality gate)
  //   - planner_role IS NOT NULL (must be tagged)
  //   - planner_role != 'pantry' (pantry items live in Explore only, never
  //     enter the planner)
  // Single query unions primary-role match (`planner_role IN (...)`) with
  // alternate-role match (`alternate_planner_roles && {...}`) via PostgREST
  // `.or()`. PostgREST returns each row once even when both branches match,
  // so no client-side dedupe is needed. meal_components is enforced later at
  // scoring time per slot — not a universal SQL filter.
  const rolesCsv = neededRolesList.join(",");
  const { data: rawRecipeRows, error: recipeError } = await ctx.supabase
    .from("recipes")
    .select(selectFields)
    .eq("is_published", true)
    .not("planner_role", "is", null)
    .neq("planner_role", "pantry")
    .or(
      `planner_role.in.(${rolesCsv}),alternate_planner_roles.ov.{${rolesCsv}}`,
    );

  if (recipeError) {
    throw new Error(`Candidate fetch failed: ${recipeError.message}`);
  }

  const rawRows = (rawRecipeRows ?? []) as unknown as RawRecipeRow[];
  const filteredRows = rawRows
    .filter((r) => !ctx.hardExcludedRecipeIds.has(r.id))
    .filter((r) => isRoleEligibleForAnySlot(r, neededRoles))
    .filter((r) => satisfiesRoleConditionalMealComponents(r));

  // Resolve every ingredient translation name → canonical English key in one
  // batch, so per-candidate hydration stays sync. Without this, allergen and
  // dislike matching would compare locale-keyed names (`pollo`, `cacahuates`)
  // against canonical allergen_groups values (`chicken`, `peanut_butter`) and
  // silently fail for non-English users.
  const canonicalByRawName = await buildCanonicalIngredientMap(
    ctx.supabase,
    filteredRows,
    ctx.localeChain,
  );

  const hydrated = filteredRows.map((r) =>
    toCandidate(r, ctx, canonicalByRawName)
  );

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

  return splitCandidatesBySlot(slots, candidates, ctx.warnings);
}

/**
 * Partition candidates per slot. Every slot kind uses the same retrieval cap
 * and the same pool — scoring applies the busy-day and leftover-source
 * biases. The shortlist uses a deterministic slot-fit heuristic so the cap
 * keeps the strongest candidates instead of an arbitrary UUID slice.
 */
function splitCandidatesBySlot(
  slots: MealSlot[],
  candidates: RecipeCandidate[],
  warnings?: string[],
): CandidateMap {
  const bySlot: CandidateMap = new Map();
  const warnedMealTypes = new Set<CanonicalMealType>();

  for (const slot of slots) {
    const allowedRoles = MEAL_TYPE_PRIMARY_ROLES[slot.canonicalMealType];
    // A candidate is compatible if EITHER its primary planner_role matches
    // any of the meal-type's expected roles OR one of its
    // alternate_planner_roles does. Per recipe-role-model.md §6.2.
    const roleCompatible = candidates.filter((c) => {
      if (allowedRoles.includes(c.plannerRole)) return true;
      return c.alternatePlannerRoles.some((role) =>
        allowedRoles.includes(role)
      );
    });
    const compatible = roleCompatible.filter((c) =>
      c.mealTypeTags.includes(slot.canonicalMealType)
    );
    if (
      roleCompatible.length > 0 && compatible.length === 0 &&
      !warnedMealTypes.has(slot.canonicalMealType)
    ) {
      warnings?.push(
        `MISSING_MEAL_TYPE_TAGS:meal_type=${slot.canonicalMealType}`,
      );
      warnedMealTypes.add(slot.canonicalMealType);
    }
    bySlot.set(slot.slotId, shortlistCandidatesForSlot(slot, compatible));
  }

  return bySlot;
}

/**
 * Total unique candidates across all slots — used for thin-catalog checks.
 */
export function countUniqueCandidates(map: CandidateMap): number {
  const ids = new Set<string>();
  for (const arr of map.values()) {
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

export interface CookHistory {
  /** recipeId → most-recent cook timestamp within the window. */
  recentCooked: Map<string, Date>;
  /** recipeId → cook count within the window. */
  cookCount: Map<string, number>;
}

/**
 * Load the user's recent cook history in a single SELECT. Two maps are
 * derived from the same row set:
 *   - `recentCooked` — powers the recentRecipePenalty in the variety factor.
 *   - `cookCount`    — powers the familyFavoriteBoost in taste+household.
 *
 * Previously split across two queries (`loadRecentCookedRecipeIds` and
 * `loadCookCount`). Both want the same 30-day slice of `user_events`, so
 * collapsing saves a round-trip per generation.
 */
export async function loadCookHistory(
  supabase: SupabaseClient,
  userId: string,
  sinceDaysAgo = 30,
): Promise<CookHistory> {
  const cutoff = new Date(Date.now() - sinceDaysAgo * 86_400_000).toISOString();
  const recentCooked = new Map<string, Date>();
  const cookCount = new Map<string, number>();
  try {
    const { data, error } = await supabase
      .from("user_events")
      .select("payload, created_at")
      .eq("user_id", userId)
      .eq("event_type", "cook_complete")
      .gte("created_at", cutoff)
      .limit(2000);
    if (error || !data) return { recentCooked, cookCount };
    for (
      const row of data as Array<{
        payload: Record<string, unknown>;
        created_at: string;
      }>
    ) {
      const recipeId = row.payload?.recipe_id;
      if (typeof recipeId !== "string" || recipeId.length === 0) continue;
      const when = new Date(row.created_at);
      const existing = recentCooked.get(recipeId);
      if (!existing || when > existing) recentCooked.set(recipeId, when);
      cookCount.set(recipeId, (cookCount.get(recipeId) ?? 0) + 1);
    }
  } catch {
    // swallow — cook history is a best-effort signal
  }
  return { recentCooked, cookCount };
}
