/**
 * Bundle Builder
 *
 * Given a primary (main) recipe assigned to a slot, attach compatible
 * components via explicit `recipe_pairings` rows only. Rules per task brief:
 *   - condiments: explicit-pairing only, after coverage, max 1, total ≤ 3
 *   - sides/bases/veg: explicit-pairing only, filling food_groups gaps
 *
 * Spec: meal-slot-schema.md §2–§3; ranking-algorithm-detail.md §2 assembly
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { RecipeCandidate } from "./candidate-retrieval.ts";
import type { MealSlot } from "./slot-classifier.ts";
import { CONDIMENT_RULES } from "./scoring-config.ts";
import type { ComponentRole, PairingBasis, SourceKind } from "./types.ts";

export interface SlotComponent {
  role: ComponentRole;
  sourceKind: SourceKind;
  recipeId: string | null;
  sourceComponentId: string | null;
  foodGroupsSnapshot: string[];
  pairingBasis: PairingBasis;
  isPrimary: boolean;
  candidate: RecipeCandidate | null; // null for leftover / no-cook placeholders
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

  // Hydrate target candidates.
  const targetIds = [
    ...new Set((pairings as PairingRow[]).map((p) => p.target_recipe_id)),
  ];
  if (targetIds.length === 0) return { byRole, candidatesById };

  const { data: targets, error: targetError } = await supabase
    .from("recipes")
    .select(`
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
      recipe_translations ( locale, name )
    `)
    .in("id", targetIds)
    .eq("is_published", true);

  if (targetError || !targets) return { byRole, candidatesById };

  for (const row of targets as Array<Record<string, unknown>>) {
    const translations = (row.recipe_translations as Array<
      { locale: string; name: string | null }
    >) ??
      [];
    const title = translations.find((t) => t.name)?.name ?? "";
    const candidate: RecipeCandidate = {
      id: row.id as string,
      title,
      plannerRole: (row.planner_role as string) ?? "",
      foodGroups: (row.food_groups as string[]) ?? [],
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
      ingredientIds: [],
      ingredientKeys: [],
      cuisineTags: [],
      hasAllergenConflict: false,
      allergenMatches: [],
    };
    candidatesById.set(candidate.id, candidate);
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
    foodGroupsSnapshot: candidate.foodGroups,
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

/**
 * Build a bounded component bundle anchored on `primary`.
 *
 * Order:
 *   1. Primary (main)
 *   2. Fill structure_template food-group gaps with explicit sides/base/veg
 *   3. Dessert/beverage if the template allows another component
 *   4. Condiment (max 1, total ≤ 3, after coverage — only via explicit pairing)
 */
export function buildBundle(
  slot: MealSlot,
  primary: RecipeCandidate,
  pairings: PairingLookup,
): SlotComponent[] {
  const components: SlotComponent[] = [];
  components.push(toComponent(primary, "main", "standalone", true, 0, null));

  const budget = targetComponentCount(slot.structureTemplate);
  if (budget <= 1) return components;

  const pairingsBySource = pairings.byRole.get(primary.id);
  if (!pairingsBySource) return components;

  const coveredGroups = new Set<string>(primary.foodGroups);
  const filledRoles = new Set<string>(["main"]);

  const addComponent = (
    role: ComponentRole,
    candidate: RecipeCandidate,
    basis: PairingBasis,
    reason: string | null,
  ) => {
    if (components.length >= budget) return;
    if (role !== "condiment" && filledRoles.has(role)) return;
    components.push(
      toComponent(candidate, role, basis, false, components.length, reason),
    );
    filledRoles.add(role);
    for (const g of candidate.foodGroups) coveredGroups.add(g);
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
      if (components.length >= budget) break;
      const target = pairings.candidatesById.get(pairing.target_recipe_id);
      if (!target) continue;
      const currentFoodGroups = target.foodGroups;
      const addsCoverage = currentFoodGroups.some((g) => !coveredGroups.has(g));
      if (!addsCoverage && role !== "beverage" && role !== "dessert") continue;
      addComponent(role, target, "explicit_pairing", pairing.reason);
      break;
    }
  }

  // Condiment rule: only when coverage is done and slot has room.
  if (!CONDIMENT_RULES.attachAfterCoverage || components.length >= budget) {
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
    addComponent("condiment", target, "explicit_pairing", c.reason);
    condimentsAdded++;
  }

  return components.slice(0, CONDIMENT_RULES.totalComponentsPerSlot);
}

function targetComponentCount(
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
 * Placeholder components for leftover targets and no-cook fallbacks that carry
 * no concrete recipe. Used so the plan persistence layer has a consistent
 * shape regardless of whether the slot materialized as a recipe, leftover, or
 * no-cook meal.
 */
export function buildLeftoverPlaceholder(
  _slot: MealSlot,
  sourceComponentId: string,
  sourceTitle: string,
): SlotComponent {
  return {
    role: "main",
    sourceKind: "leftover",
    recipeId: null,
    sourceComponentId,
    foodGroupsSnapshot: [],
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

export function buildNoCookPlaceholder(
  _slot: MealSlot,
  title: string,
): SlotComponent {
  return {
    role: "main",
    sourceKind: "no_cook",
    recipeId: null,
    sourceComponentId: null,
    foodGroupsSnapshot: [],
    pairingBasis: "standalone",
    isPrimary: true,
    candidate: null,
    displayOrder: 0,
    titleSnapshot: title,
    imageSnapshot: null,
    totalTimeSnapshot: null,
    difficultySnapshot: null,
    portionsSnapshot: null,
    equipmentSnapshot: [],
    selectionReason: null,
  };
}
