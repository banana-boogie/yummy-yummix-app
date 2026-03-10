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

  // === English test cases ===
  {
    id: "recipe-1-carbonara-en",
    description:
      "Pasta carbonara (EN) — classic dish with specific ingredients",
    language: "en",
    ingredients: ["pasta", "eggs", "bacon", "parmesan cheese"],
  },
  {
    id: "recipe-2-quick-dinner-en",
    description: "Quick dinner (EN) — 30 min time constraint",
    language: "en",
    ingredients: ["chicken", "rice", "broccoli"],
    targetTime: 30,
  },
  {
    id: "recipe-3-mole-en",
    description: "Traditional mole poblano (EN) — complex Mexican dish",
    language: "en",
    ingredients: [
      "dried chiles",
      "chocolate",
      "almonds",
      "sesame seeds",
      "tortillas",
      "chicken",
      "onion",
      "garlic",
    ],
    cuisinePreference: "Mexican",
  },
  {
    id: "recipe-4-vegan-cake-en",
    description: "Vegan chocolate cake (EN) — dietary constraint: vegan",
    language: "en",
    ingredients: [
      "flour",
      "cocoa powder",
      "almond milk",
      "banana",
      "coconut oil",
      "sugar",
    ],
    additionalRequests: "vegan, no eggs or dairy",
  },
  {
    id: "recipe-5-thermomix-soup-en",
    description: "Cream of vegetable soup (EN) — explicit Thermomix usage",
    language: "en",
    ingredients: [
      "carrot",
      "potato",
      "zucchini",
      "onion",
      "garlic",
      "chicken broth",
    ],
    additionalRequests: "use Thermomix for everything",
  },
  {
    id: "recipe-6-fast-easy-en",
    description: "Quick 20-minute meal (EN) — time + difficulty constraints",
    language: "en",
    ingredients: ["eggs", "tortillas", "beans", "cheese", "salsa"],
    targetTime: 20,
    difficulty: "easy",
  },
];
