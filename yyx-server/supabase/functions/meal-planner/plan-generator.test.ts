import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  annotateCandidates,
  PlanAlreadyExistsError,
} from "./plan-generator.ts";
import type { RecipeCandidate } from "./candidate-retrieval.ts";

Deno.test("PlanAlreadyExistsError carries the existing plan id", () => {
  const err = new PlanAlreadyExistsError("plan-abc");
  assertEquals(err.existingPlanId, "plan-abc");
  assertEquals(err.name, "PlanAlreadyExistsError");
  if (!(err instanceof PlanAlreadyExistsError)) {
    throw new Error("instanceof check failed");
  }
});

Deno.test("PlanAlreadyExistsError is an Error subclass", () => {
  const err = new PlanAlreadyExistsError("plan-xyz");
  if (!(err instanceof Error)) {
    throw new Error("should subclass Error");
  }
});

Deno.test("PlanAlreadyExistsError existingPlanId can be null for insert-race path", () => {
  const err = new PlanAlreadyExistsError(null);
  assertEquals(err.existingPlanId, null);
});

function mkCandidate(
  id: string,
  ingredientKeys: string[],
): RecipeCandidate {
  return {
    id,
    title: `Recipe ${id}`,
    plannerRole: "main",
    foodGroups: ["protein"],
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
    ingredientKeys,
    cuisineTags: [],
    hasAllergenConflict: false,
    allergenMatches: [],
  };
}

Deno.test("annotateCandidates: word-boundary match flags real allergens", () => {
  const candidate = mkCandidate("r-bread", ["bread", "water", "salt"]);
  annotateCandidates(
    [candidate],
    new Map([["gluten", new Set(["bread"])]]),
  );
  assertEquals(candidate.hasAllergenConflict, true);
  assertEquals(candidate.allergenMatches, ["gluten"]);
});

Deno.test("annotateCandidates: does NOT false-positive on compound words (breadfruit vs bread)", () => {
  const candidate = mkCandidate("r-breadfruit", ["breadfruit", "coconut_milk"]);
  annotateCandidates(
    [candidate],
    new Map([["gluten", new Set(["bread"])]]),
  );
  // `breadfruit` should not trigger `bread`; word-boundary matching protects
  // against the naive substring match that the previous implementation used.
  assertEquals(candidate.hasAllergenConflict, false);
  assertEquals(candidate.allergenMatches, []);
});

Deno.test("annotateCandidates: handles underscore-separated normalized keys", () => {
  // After normalizeKey("peanut butter") → "peanut_butter"; allergen canonical
  // is already "peanut_butter". matchesAllergen replaces `_` with flexible
  // separators so this matches.
  const candidate = mkCandidate("r-pb", ["peanut_butter", "jelly"]);
  annotateCandidates(
    [candidate],
    new Map([["nuts", new Set(["peanut_butter"])]]),
  );
  assertEquals(candidate.hasAllergenConflict, true);
  assertEquals(candidate.allergenMatches, ["nuts"]);
});

Deno.test("annotateCandidates: does not duplicate restriction entries", () => {
  const candidate = mkCandidate("r-dairy", [
    "whole_milk",
    "cheddar_cheese",
    "yogurt",
  ]);
  annotateCandidates(
    [candidate],
    new Map([["dairy", new Set(["whole_milk", "cheddar_cheese", "yogurt"])]]),
  );
  // All three ingredients match the same restriction — should appear once.
  assertEquals(candidate.hasAllergenConflict, true);
  assertEquals(candidate.allergenMatches, ["dairy"]);
});

Deno.test("annotateCandidates: empty allergen map is a no-op", () => {
  const candidate = mkCandidate("r-plain", ["flour", "sugar"]);
  annotateCandidates([candidate], new Map());
  assertEquals(candidate.hasAllergenConflict, false);
  assertEquals(candidate.allergenMatches, []);
});
