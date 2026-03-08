/**
 * AI Model Tournament — Recipe Generation Test Cases
 *
 * 6 prompts testing recipe generation quality with varied constraints.
 */

import type { RecipeTestCase } from "../types.ts";

export const RECIPE_GENERATION_TEST_CASES: RecipeTestCase[] = [
  {
    id: "recipe-1-carbonara",
    description: "Pasta carbonara — classic dish with specific ingredients",
    ingredients: ["pasta", "huevos", "tocino", "queso parmesano"],
  },
  {
    id: "recipe-2-quick-dinner",
    description: "Quick dinner — 30 min time constraint",
    ingredients: ["pollo", "arroz", "brócoli"],
    targetTime: 30,
  },
  {
    id: "recipe-3-mole",
    description:
      "Mole poblano tradicional — complex Mexican dish with many ingredients",
    ingredients: [
      "chiles secos",
      "chocolate",
      "almendras",
      "ajonjolí",
      "tortillas",
      "pollo",
      "cebolla",
      "ajo",
    ],
    cuisinePreference: "mexicana",
  },
  {
    id: "recipe-4-vegan-cake",
    description: "Pastel de chocolate vegano — dietary constraint: vegan",
    ingredients: [
      "harina",
      "cacao en polvo",
      "leche de almendras",
      "plátano",
      "aceite de coco",
      "azúcar",
    ],
    additionalRequests: "vegano, sin huevo ni lácteos",
  },
  {
    id: "recipe-5-thermomix-soup",
    description: "Crema de verduras en Thermomix — explicit Thermomix usage",
    ingredients: [
      "zanahoria",
      "papa",
      "calabacín",
      "cebolla",
      "ajo",
      "caldo de pollo",
    ],
    additionalRequests: "usar Thermomix para todo",
  },
  {
    id: "recipe-6-fast-easy",
    description: "Algo rápido en 20 minutos — time + difficulty constraints",
    ingredients: ["huevos", "tortillas", "frijoles", "queso", "salsa"],
    targetTime: 20,
    difficulty: "easy",
  },
];
