/**
 * Bundle Builder
 *
 * Given a primary (main) recipe assigned to a slot, attach compatible
 * components via explicit `recipe_pairings` rows only. Rules per task brief:
 *   - condiments: explicit-pairing only, after coverage, max 1, total ≤ 4
 *   - sides/bases/veg: explicit-pairing only, filling meal_components gaps
 *
 * Spec: meal-slot-schema.md §2–§3; ranking-algorithm-detail.md §2 assembly
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  buildCanonicalIngredientMap,
  normalizeKey,
  pickTranslationName,
  type RecipeCandidate,
} from "./candidate-retrieval.ts";
import type { MealSlot } from "./slot-classifier.ts";
import { CONDIMENT_RULES } from "./scoring-config.ts";
import type { ComponentRole, PairingBasis, SourceKind } from "./types.ts";

export interface SlotComponent {
  role: ComponentRole;
  sourceKind: SourceKind;
  recipeId: string | null;
  /**
   * Final DB UUID of the source component for `source_kind = 'leftover'`.
   * Populated post-persist; null in-memory. See `sourceSlotIdRef` for the
   * planner-internal reference used during the two-phase component insert.
   */
  sourceComponentId: string | null;
  /**
   * For leftover components: the slotId of the source meal whose primary
   * component will feed this leftover. Used during persistence to look up
   * the real DB UUID of that primary component and populate
   * `source_component_id`. Null for non-leftover components.
   */
  sourceSlotIdRef: string | null;
  mealComponentsSnapshot: string[];
  pairingBasis: PairingBasis;
  isPrimary: boolean;
  candidate: RecipeCandidate | null; // null for leftover placeholders
  displayOrder: number;
  titleSnapshot: string;
  imageSnapshot: string | null;
  totalTimeSnapshot: number | null;
  difficultySnapshot: "easy" | "medium" | "hard" | null;
  portionsSnapshot: number | null;
  equipmentSnapshot: string[];
  selectionReason?: string | null;
}

interface PairingRow {
  source_recipe_id: string;
  target_recipe_id: string;
  pairing_role: string;
  reason: string | null;
}

export interface PairingLookup {
  // source_recipe_id → pairings by role
  byRole: Map<string, Map<string, PairingRow[]>>;
  // recipe candidate id → prefetched candidate (subset of catalog)
  candidatesById: Map<string, RecipeCandidate>;
}

/**
 * Fetch pairings for the given set of primary candidate recipe IDs and
 * pre-hydrate their targets so the builder can place components without
 * additional DB round-trips during beam search.
 */
export async function fetchPairingsForCandidates(
  supabase: SupabaseClient,
  primaryRecipeIds: string[],
  localeChain: string[],
): Promise<PairingLookup> {
  const byRole = new Map<string, Map<string, PairingRow[]>>();
  const candidatesById = new Map<string, RecipeCandidate>();

  if (primaryRecipeIds.length === 0) return { byRole, candidatesById };

  const { data: pairings, error } = await supabase
    .from("recipe_pairings")
    .select("source_recipe_id, target_recipe_id, pairing_role, reason")
    .in("source_recipe_id", primaryRecipeIds);

  if (error || !pairings) return { byRole, candidatesById };

  for (const p of pairings as PairingRow[]) {
    const slot = byRole.get(p.source_recipe_id) ??
      new Map<string, PairingRow[]>();
    const list = slot.get(p.pairing_role) ?? [];
    list.push(p);
    slot.set(p.pairing_role, list);
    byRole.set(p.source_recipe_id, slot);
  }

  // Hydrate target candidates. We include recipe_ingredients so downstream
  // allergen annotation can match paired sides/bases against the user's
  // dietary restrictions — otherwise a user with a gluten allergy could get
  // an allergen-safe primary dish with a gluten-heavy paired side.
  const targetIds = [
    ...new Set((pairings as PairingRow[]).map((p) => p.target_recipe_id)),
  ];
  if (targetIds.length === 0) return { byRole, candidatesById };

  const { data: targets, error: targetError } = await supabase
    .from("recipes")
    .select(`
      id,
      planner_role,
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
      recipe_ingredients ( ingredient_id, ingredients ( id, ingredient_translations ( locale, name ) ) )
    `)
    .in("id", targetIds)
    .eq("is_published", true);

  if (targetError || !targets) return { byRole, candidatesById };

  // Resolve every paired target's locale-chain ingredient name → canonical
  // English key once, batched. Allergen + dislike matching downstream
  // compares against canonical values from `allergen_groups`, so the keys
  // we attach to the candidate must be canonical too. Without this, an es
  // user's pairing target with `pollo` would never match the `chicken`
  // allergen and a flagged side could slip through the bundle filter.
  const canonicalByRawName = await buildCanonicalIngredientMap(
    supabase,
    targets as unknown as Array<{
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
    }>,
    localeChain,
  );

  let droppedForLocale = 0;
  for (const row of targets as Array<Record<string, unknown>>) {
    const translations = (row.recipe_translations as Array<
      { locale: string; name: string | null }
    >) ?? [];
    const title = pickTranslationName(translations, localeChain);
    if (!title) {
      // No same-language translation available — drop the pairing target
      // rather than cross-language fallback.
      droppedForLocale++;
      continue;
    }

    const ingredientIds: string[] = [];
    const ingredientKeys: string[] = [];
    const rawIngredients = (row.recipe_ingredients as Array<{
      ingredient_id: string | null;
      ingredients: {
        id: string;
        ingredient_translations: Array<{ locale: string; name: string | null }>;
      } | null;
    }>) ?? [];
    for (const ri of rawIngredients) {
      const ing = ri.ingredients;
      if (!ing) continue;
      ingredientIds.push(ing.id);
      const ingName = pickTranslationName(
        ing.ingredient_translations ?? [],
        localeChain,
      );
      if (!ingName) continue;
      const canonical = canonicalByRawName.get(ingName) ?? ingName;
      ingredientKeys.push(normalizeKey(canonical));
    }

    const candidate: RecipeCandidate = {
      id: row.id as string,
      title,
      plannerRole: (row.planner_role as string) ?? "",
      mealComponents: (row.meal_components as string[]) ?? [],
      isComplete: !!row.is_complete_meal,
      totalTimeMinutes: (row.total_time as number | null) ?? null,
      difficulty: (row.difficulty as "easy" | "medium" | "hard" | null) ?? null,
      portions: (row.portions as number | null) ?? null,
      imageUrl: (row.image_url as string | null) ?? null,
      leftoversFriendly: !!row.leftovers_friendly,
      batchFriendly: (row.batch_friendly as boolean | null) ?? null,
      maxHouseholdSizeSupported:
        (row.max_household_size_supported as number | null) ?? null,
      equipmentTags: (row.equipment_tags as string[]) ?? [],
      cookingLevel: (row.cooking_level as
        | "beginner"
        | "intermediate"
        | "experienced"
        | null) ?? null,
      verifiedAt: (row.verified_at as string | null) ?? null,
      isPublished: !!row.is_published,
      ingredientIds,
      ingredientKeys,
      cuisineTags: [],
      // Pairing targets bypass meal-type filtering — they're attached to a
      // primary via explicit recipe_pairings rows, not via the slot's
      // meal-type compatibility check, so meal-type tags aren't loaded here.
      mealTypeTags: [],
      hasAllergenConflict: false,
      allergenMatches: [],
      hasDislikeConflict: false,
      dislikeMatches: [],
      // Pairing targets are matched via explicit recipe_pairings rows, not
      // via planner_role lookup, so the alternate-role list isn't needed.
      alternatePlannerRoles: [],
    };
    candidatesById.set(candidate.id, candidate);
  }

  if (droppedForLocale > 0) {
    console.warn(
      `[bundle-builder] Dropped ${droppedForLocale} pairing target(s) missing translation for locale chain=${
        localeChain.join(",")
      }`,
    );
  }

  return { byRole, candidatesById };
}

function toComponent(
  candidate: RecipeCandidate,
  role: ComponentRole,
  pairingBasis: PairingBasis,
  isPrimary: boolean,
  displayOrder: number,
  reason: string | null,
): SlotComponent {
  return {
    role,
    sourceKind: "recipe",
    recipeId: candidate.id,
    sourceComponentId: null,
    sourceSlotIdRef: null,
    mealComponentsSnapshot: candidate.mealComponents,
    pairingBasis,
    isPrimary,
    candidate,
    displayOrder,
    titleSnapshot: candidate.title,
    imageSnapshot: candidate.imageUrl,
    totalTimeSnapshot: candidate.totalTimeMinutes,
    difficultySnapshot: candidate.difficulty,
    portionsSnapshot: candidate.portions,
    equipmentSnapshot: candidate.equipmentTags,
    selectionReason: reason,
  };
}

function primaryRoleForSlot(slot: MealSlot): ComponentRole {
  switch (slot.canonicalMealType) {
    case "snack":
      return "snack";
    case "dessert":
      return "dessert";
    case "beverage":
      return "beverage";
    case "breakfast":
    case "lunch":
    case "dinner":
      return "main";
  }
}

/**
 * Build a bounded component bundle anchored on `primary`.
 *
 * Order:
 *   1. Primary (main)
 *   2. Fill structure_template food-group gaps with explicit sides/base/veg
 *   3. Dessert/beverage if the template allows another component
 *   4. Condiment (max 1, total ≤ 4, after coverage — only via explicit pairing)
 */
export function buildBundle(
  slot: MealSlot,
  primary: RecipeCandidate,
  pairings: PairingLookup,
): SlotComponent[] {
  const components: SlotComponent[] = [];
  components.push(
    toComponent(primary, primaryRoleForSlot(slot), "standalone", true, 0, null),
  );

  const coverageBudget = targetComponentCount(slot.structureTemplate);
  if (coverageBudget <= 1) return components;

  const pairingsBySource = pairings.byRole.get(primary.id);
  if (!pairingsBySource) return components;

  const coveredComponents = new Set<string>(primary.mealComponents);
  const filledRoles = new Set<string>(["main"]);

  const addComponent = (
    role: ComponentRole,
    candidate: RecipeCandidate,
    basis: PairingBasis,
    reason: string | null,
    options: { enforceCoverageBudget?: boolean } = {},
  ) => {
    const enforceCoverageBudget = options.enforceCoverageBudget ?? true;
    if (enforceCoverageBudget && components.length >= coverageBudget) return;
    if (components.length >= CONDIMENT_RULES.totalComponentsPerSlot) return;
    if (role !== "condiment" && filledRoles.has(role)) return;
    components.push(
      toComponent(candidate, role, basis, false, components.length, reason),
    );
    filledRoles.add(role);
    for (const g of candidate.mealComponents) coveredComponents.add(g);
  };

  const rolePriority: ComponentRole[] = [
    "side",
    "base",
    "veg",
    "beverage",
    "dessert",
  ];

  for (const role of rolePriority) {
    const candidates = pairingsBySource.get(role);
    if (!candidates || candidates.length === 0) continue;
    for (const pairing of candidates) {
      if (components.length >= coverageBudget) break;
      const target = pairings.candidatesById.get(pairing.target_recipe_id);
      if (!target) continue;
      if (target.hasAllergenConflict) continue; // hard dietary filter
      if (target.hasDislikeConflict) continue; // explicit dislike hard filter
      const targetComponents = target.mealComponents;
      const addsCoverage = targetComponents.some((g) =>
        !coveredComponents.has(g)
      );
      if (!addsCoverage && role !== "beverage" && role !== "dessert") continue;
      addComponent(role, target, "explicit_pairing", pairing.reason);
      break;
    }
  }

  // Condiment rule: only after the coverage pass has satisfied the slot and
  // the separate absolute component cap still has room.
  const hasExpectedCoverage = slot.expectedMealComponents.every((g) =>
    coveredComponents.has(g)
  );
  const hasStructureCoverage = components.length >= coverageBudget ||
    hasExpectedCoverage;
  if (
    !CONDIMENT_RULES.attachAfterCoverage ||
    !hasStructureCoverage ||
    components.length >= CONDIMENT_RULES.totalComponentsPerSlot
  ) {
    return components.slice(0, CONDIMENT_RULES.totalComponentsPerSlot);
  }

  const condiments = pairingsBySource.get("condiment");
  if (!condiments || condiments.length === 0) {
    return components.slice(0, CONDIMENT_RULES.totalComponentsPerSlot);
  }

  let condimentsAdded = 0;
  for (const c of condiments) {
    if (condimentsAdded >= CONDIMENT_RULES.maxPerSlot) break;
    if (components.length >= CONDIMENT_RULES.totalComponentsPerSlot) break;
    if (!CONDIMENT_RULES.explicitPairingOnly) break; // always true per config
    const target = pairings.candidatesById.get(c.target_recipe_id);
    if (!target) continue;
    if (target.hasAllergenConflict) continue; // hard dietary filter
    if (target.hasDislikeConflict) continue; // explicit dislike hard filter
    addComponent("condiment", target, "explicit_pairing", c.reason, {
      enforceCoverageBudget: false,
    });
    condimentsAdded++;
  }

  return components.slice(0, CONDIMENT_RULES.totalComponentsPerSlot);
}

function targetComponentCount(
  template: MealSlot["structureTemplate"],
): number {
  return templateComponentCount(template);
}

/**
 * Map a `structure_template` value to the number of components it represents.
 * Exported so persistence + response code can recompute the template from an
 * actual component count without importing the switch in multiple places.
 */
export function templateComponentCount(
  template: MealSlot["structureTemplate"],
): number {
  switch (template) {
    case "single_component":
      return 1;
    case "main_plus_one_component":
      return 2;
    case "main_plus_two_components":
      return 3;
    default:
      return 1;
  }
}

/**
 * Inverse of `templateComponentCount`: given an actual component count, return
 * the `structure_template` value that best describes the bundle. Used by the
 * persistence + response layers so a slot classified as "main_plus_one" but
 * built with only the primary (no pairings matched) is persisted as
 * "single_component", matching what the user will actually see.
 */
export function templateForComponentCount(
  count: number,
): MealSlot["structureTemplate"] {
  if (count >= 3) return "main_plus_two_components";
  if (count === 2) return "main_plus_one_component";
  return "single_component";
}

/**
 * Placeholder components for leftover targets and no-cook fallbacks that carry
 * no concrete recipe. Used so the plan persistence layer has a consistent
 * shape regardless of whether the slot materialized as a recipe, leftover, or
 * no-cook meal.
 *
 * For leftovers we carry `sourceSlotIdRef` — the slotId of the meal that will
 * feed this leftover. The persistence layer uses that reference during a
 * two-phase insert to resolve the real DB UUID for `source_component_id`,
 * which the schema's `components_source_lineage_check` constraint requires.
 */
export function buildLeftoverPlaceholder(
  _slot: MealSlot,
  sourceSlotId: string,
  sourceTitle: string,
): SlotComponent {
  return {
    role: "main",
    sourceKind: "leftover",
    recipeId: null,
    sourceComponentId: null,
    sourceSlotIdRef: sourceSlotId,
    mealComponentsSnapshot: [],
    pairingBasis: "leftover_carry",
    isPrimary: true,
    candidate: null,
    displayOrder: 0,
    titleSnapshot: sourceTitle,
    imageSnapshot: null,
    totalTimeSnapshot: null,
    difficultySnapshot: null,
    portionsSnapshot: null,
    equipmentSnapshot: [],
    selectionReason: null,
  };
}
