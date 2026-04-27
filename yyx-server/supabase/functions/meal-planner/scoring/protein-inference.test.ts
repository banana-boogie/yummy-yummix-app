import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { RecipeCandidate } from "../candidate-retrieval.ts";
import { inferProteinKey } from "./protein-inference.ts";

function candidate(overrides: Partial<RecipeCandidate> = {}): RecipeCandidate {
  return {
    id: "r1",
    title: "Test Recipe",
    plannerRole: "main",
    alternatePlannerRoles: [],
    mealComponents: ["protein"],
    isComplete: false,
    totalTimeMinutes: 30,
    difficulty: "easy",
    portions: 2,
    imageUrl: null,
    leftoversFriendly: false,
    batchFriendly: null,
    maxHouseholdSizeSupported: null,
    equipmentTags: [],
    cookingLevel: null,
    verifiedAt: null,
    isPublished: true,
    ingredientIds: [],
    ingredientKeys: [],
    cuisineTags: [],
    mealTypeTags: ["dinner"],
    hasAllergenConflict: false,
    allergenMatches: [],
    hasDislikeConflict: false,
    dislikeMatches: [],
    ...overrides,
  };
}

Deno.test("inferProteinKey returns null when protein marker is unknown", () => {
  assertEquals(
    inferProteinKey(candidate({ ingredientKeys: ["unknown_cut"] })),
    null,
  );
});

Deno.test("inferProteinKey returns known marker when present", () => {
  assertEquals(
    inferProteinKey(candidate({ ingredientKeys: ["chicken_breast"] })),
    "chicken",
  );
});
