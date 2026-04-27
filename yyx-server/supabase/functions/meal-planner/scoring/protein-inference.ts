/**
 * Infer a primary protein key for variety tracking + affinity lookup.
 *
 * No `primary_protein_tag` column exists on recipes yet. As a best-effort we
 * scan the ingredient keys for known protein markers. Same list and logic are
 * used by the variety factor, the taste/household factor, and the week
 * assembler's adjacency check — keeping them in one place here avoids drift.
 */

import type { RecipeCandidate } from "../candidate-retrieval.ts";

const PROTEIN_MARKERS: ReadonlyArray<string> = [
  "chicken",
  "pollo",
  "beef",
  "carne_de_res",
  "pork",
  "cerdo",
  "fish",
  "pescado",
  "shrimp",
  "camaron",
  "tofu",
  "egg",
  "huevo",
  "lentil",
  "lenteja",
  "beans",
  "frijol",
  "chickpea",
  "garbanzo",
];

export function inferProteinKey(candidate: RecipeCandidate): string | null {
  if (!candidate.mealComponents.includes("protein")) return null;
  for (const key of candidate.ingredientKeys) {
    for (const marker of PROTEIN_MARKERS) {
      if (key.includes(marker)) return marker;
    }
  }
  return null;
}
