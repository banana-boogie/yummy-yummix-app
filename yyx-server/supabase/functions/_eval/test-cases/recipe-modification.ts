/**
 * AI Model Tournament — Recipe Modification Test Cases
 *
 * 4 modification requests applied to the base recipe fixture
 * ("Arroz con pollo", 4 portions).
 */

import type { ModificationTestCase } from "../types.ts";

export const RECIPE_MODIFICATION_TEST_CASES: ModificationTestCase[] = [
  {
    id: "mod-1-scale-portions",
    description: "Scale portions 4→8",
    modificationRequest: "Hazlo para 8 personas",
    expectedBehavior:
      "Doubles all ingredient quantities, sets portions to 8. May adjust cooking time.",
  },
  {
    id: "mod-2-remove-allergen",
    description: "Remove allergen — almonds (nuts)",
    modificationRequest: "Sin almendras, mi hijo es alérgico",
    expectedBehavior:
      "Removes almendras from ingredients and steps. May suggest substitute.",
  },
  {
    id: "mod-3-dietary-adaptation",
    description: "Dietary adaptation — make vegan",
    modificationRequest: "Hazlo vegano",
    expectedBehavior:
      "Replaces pollo and caldo de pollo with plant-based alternatives. Removes all animal products.",
  },
  {
    id: "mod-4-simplify",
    description: "Simplify — fewer steps",
    modificationRequest: "Menos pasos, más sencillo",
    expectedBehavior:
      "Reduces step count, may combine steps. Keeps essential cooking steps.",
  },
];
