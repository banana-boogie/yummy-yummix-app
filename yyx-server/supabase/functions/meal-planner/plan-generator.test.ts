import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  annotateCandidates,
  annotateDislikeConflicts,
  countUniqueViableCandidates,
  countViableCandidates,
  InsufficientRecipesError,
  PlanAlreadyExistsError,
} from "./plan-generator.ts";
import type { CandidateMap, RecipeCandidate } from "./candidate-retrieval.ts";

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

Deno.test("InsufficientRecipesError is a distinguishable Error subclass", () => {
  const err = new InsufficientRecipesError();
  assertEquals(err.name, "InsufficientRecipesError");
  if (!(err instanceof InsufficientRecipesError)) {
    throw new Error("instanceof check failed");
  }
  if (!(err instanceof Error)) {
    throw new Error("should subclass Error");
  }
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
    hasDislikeConflict: false,
    dislikeMatches: [],
    alternatePlannerRoles: [],
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

Deno.test("annotateDislikeConflicts: flags candidates containing disliked ingredients", () => {
  const candidate = mkCandidate("r-shrooms", [
    "chicken_breast",
    "cremini_mushrooms",
    "olive_oil",
  ]);
  annotateDislikeConflicts([candidate], ["cremini mushrooms"]);
  assertEquals(candidate.hasDislikeConflict, true);
  assertEquals(candidate.dislikeMatches, ["cremini_mushrooms"]);
});

Deno.test("annotateDislikeConflicts: normalizes user input to canonical key form", () => {
  // "Bell Pepper" should match ingredient key `bell_pepper` via the same
  // underscore-normalization that candidate keys go through.
  const candidate = mkCandidate("r-peppers", ["bell_pepper", "onion"]);
  annotateDislikeConflicts([candidate], ["Bell Pepper"]);
  assertEquals(candidate.hasDislikeConflict, true);
  assertEquals(candidate.dislikeMatches, ["bell_pepper"]);
});

Deno.test("annotateDislikeConflicts: word-boundary prevents compound-word false positives", () => {
  // User dislikes "bean"; recipe has "green_beans_sprout" (made-up edge case).
  // Word-boundary matching: `green_beans_sprout` → segments are green/beans/
  // sprout; dislike `bean` does NOT match `beans` (no boundary after 'n').
  const candidate = mkCandidate("r-sprouts", ["green_beans_sprout"]);
  annotateDislikeConflicts([candidate], ["bean"]);
  assertEquals(candidate.hasDislikeConflict, false);
  assertEquals(candidate.dislikeMatches, []);
});

Deno.test("annotateDislikeConflicts: empty or blank dislike list is a no-op", () => {
  const candidate = mkCandidate("r-any", ["onion", "garlic"]);
  annotateDislikeConflicts([candidate], []);
  assertEquals(candidate.hasDislikeConflict, false);
  annotateDislikeConflicts([candidate], ["   ", ""]);
  assertEquals(candidate.hasDislikeConflict, false);
});

Deno.test("annotateDislikeConflicts: deduplicates multiple occurrences of same dislike", () => {
  const candidate = mkCandidate("r-onion", [
    "yellow_onion",
    "red_onion",
    "onion_powder",
  ]);
  // The normalized dislike `onion` matches all three ingredient keys — the
  // `dislikeMatches` list should only contain one entry since we dedup on
  // the dislike token, not the ingredient key.
  annotateDislikeConflicts([candidate], ["onion"]);
  assertEquals(candidate.hasDislikeConflict, true);
  assertEquals(candidate.dislikeMatches, ["onion"]);
});

Deno.test("viable candidate helpers ignore allergen and dislike conflicts", () => {
  const viable = mkCandidate("r-safe", ["chicken"]);
  const allergenConflict = mkCandidate("r-allergen", ["bread"]);
  allergenConflict.hasAllergenConflict = true;
  const dislikeConflict = mkCandidate("r-dislike", ["mushroom"]);
  dislikeConflict.hasDislikeConflict = true;

  assertEquals(
    countViableCandidates([viable, allergenConflict, dislikeConflict]),
    1,
  );

  const candidateMap: CandidateMap = new Map([
    ["slot-a", [viable, allergenConflict]],
    ["slot-b", [viable, dislikeConflict]],
  ]);
  assertEquals(countUniqueViableCandidates(candidateMap), 1);
});
