import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assembleWeek } from "./week-assembler.ts";
import type { RecipeCandidate } from "./candidate-retrieval.ts";
import type { MealSlot } from "./slot-classifier.ts";
import type { UserContext } from "./scoring/types.ts";
import type { PairingLookup } from "./bundle-builder.ts";

function mkSlot(overrides: Partial<MealSlot> = {}): MealSlot {
  return {
    slotId: "1-dinner",
    plannedDate: "2026-04-14",
    dayIndex: 1,
    canonicalMealType: "dinner",
    displayMealLabel: "dinner",
    slotKind: "cook_slot",
    isBusyDay: false,
    isWeekend: false,
    prefersLeftovers: false,
    structureTemplate: "single_component",
    ...overrides,
  };
}

function mkCandidate(
  id: string,
  overrides: Partial<RecipeCandidate> = {},
): RecipeCandidate {
  return {
    id,
    title: `Recipe ${id}`,
    plannerRole: "main",
    foodGroups: ["protein", "carb"],
    isComplete: false,
    totalTimeMinutes: 60, // well above the 20-minute no-cook budget
    difficulty: "medium",
    portions: 2,
    imageUrl: null,
    leftoversFriendly: false,
    batchFriendly: null,
    maxHouseholdSizeSupported: null,
    equipmentTags: [],
    cookingLevel: "intermediate",
    verifiedAt: null,
    isPublished: true,
    ingredientIds: ["ing-generic"],
    ingredientKeys: ["generic_ingredient"],
    cuisineTags: [],
    hasAllergenConflict: false,
    allergenMatches: [],
    hasDislikeConflict: false,
    dislikeMatches: [],
    ...overrides,
  };
}

function mkUser(overrides: Partial<UserContext> = {}): UserContext {
  return {
    userId: "u1",
    locale: "en",
    localeChain: ["en"],
    householdSize: 2,
    skillLevel: "beginner",
    dietaryRestrictions: [],
    ingredientDislikes: [],
    cuisinePreferences: [],
    nutritionGoal: "no_preference",
    preferLeftoversForLunch: false,
    defaultMaxWeeknightMinutes: 45,
    implicitPreferences: new Map(),
    evidenceWeeks: 5, // not first-week trust mode
    recentCookedRecipes: new Map(),
    cookCountByRecipe: new Map(),
    ...overrides,
  };
}

const EMPTY_PAIRINGS: PairingLookup = {
  byRole: new Map(),
  candidatesById: new Map(),
};

Deno.test("assembleWeek: no_cook_fallback_slot picks placeholder when recipes can't beat the 55-point floor", () => {
  // Spec §4.3 requires no_cook fallback to prefer true no-cook options. The
  // noCookEligible/reheatOrAssemblyFit scoring factors are clamped to 0 until
  // explicit recipe metadata exists, which limits slot-fit to ~0.15 × 20 =
  // 3 points. A slow recipe (60 min) also bottoms out on time-fit (0). Against
  // the placeholder's 55-point contribution, the placeholder must win.
  const slot = mkSlot({
    slotId: "1-dinner",
    slotKind: "no_cook_fallback_slot",
    isBusyDay: true,
    prefersLeftovers: true,
  });

  const candidates = [
    mkCandidate("slow-recipe-1", { totalTimeMinutes: 60 }),
    mkCandidate("slow-recipe-2", { totalTimeMinutes: 90 }),
  ];

  const result = assembleWeek({
    slots: [slot],
    planningOrder: [slot],
    candidates: {
      cook: new Map(),
      fallback: new Map([[slot.slotId, candidates]]),
    },
    pairings: EMPTY_PAIRINGS,
    user: mkUser(),
    leftoverTransformByRecipe: new Map(),
  });

  const assignment = result.best.assignments.get(slot.slotId);
  if (!assignment) {
    throw new Error("expected slot to be assigned");
  }
  const primary = assignment.components.find((c) => c.isPrimary);
  assertEquals(primary?.sourceKind, "no_cook");
  assertEquals(primary?.recipeId, null);
});

Deno.test("assembleWeek: no_cook_fallback_slot with empty candidate pool falls back to placeholder", () => {
  // Separate regression: when no fallback candidates exist at all, the
  // placeholder path must still run.
  const slot = mkSlot({
    slotId: "2-dinner",
    slotKind: "no_cook_fallback_slot",
    isBusyDay: true,
    prefersLeftovers: true,
  });

  const result = assembleWeek({
    slots: [slot],
    planningOrder: [slot],
    candidates: { cook: new Map(), fallback: new Map([[slot.slotId, []]]) },
    pairings: EMPTY_PAIRINGS,
    user: mkUser(),
    leftoverTransformByRecipe: new Map(),
  });

  const assignment = result.best.assignments.get(slot.slotId);
  const primary = assignment?.components.find((c) => c.isPrimary);
  assertEquals(primary?.sourceKind, "no_cook");
  // When the candidate pool was truly empty we also emit an OPEN_NO_COOK_SLOT
  // warning so the client can surface that this slot is intentionally open.
  const hasOpenWarning = result.best.warnings.some((w) =>
    w.startsWith("OPEN_NO_COOK_SLOT")
  );
  if (!hasOpenWarning) {
    throw new Error(
      "expected OPEN_NO_COOK_SLOT warning when fallback pool was empty",
    );
  }
});

Deno.test("assembleWeek: cook_slot with a strong candidate assigns that recipe", () => {
  // Sanity check — the new placeholder path is scoped to no_cook_fallback_slot;
  // regular cook slots should still assign recipes normally.
  const slot = mkSlot({ slotId: "1-dinner", slotKind: "cook_slot" });
  const candidate = mkCandidate("winner", {
    totalTimeMinutes: 30,
    verifiedAt: "2026-01-01T00:00:00Z",
  });

  const result = assembleWeek({
    slots: [slot],
    planningOrder: [slot],
    candidates: {
      cook: new Map([[slot.slotId, [candidate]]]),
      fallback: new Map(),
    },
    pairings: EMPTY_PAIRINGS,
    user: mkUser(),
    leftoverTransformByRecipe: new Map(),
  });

  const assignment = result.best.assignments.get(slot.slotId);
  const primary = assignment?.components.find((c) => c.isPrimary);
  assertEquals(primary?.sourceKind, "recipe");
  assertEquals(primary?.recipeId, "winner");
});
