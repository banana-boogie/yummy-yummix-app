/**
 * AI Model Tournament — Shared Test Fixtures
 *
 * Base recipe for modification tests and conversation history for context-dependent tests.
 */

import type { GeneratedRecipe } from "../../_shared/irmixy-schemas.ts";
import type { AIMessage } from "../../_shared/ai-gateway/types.ts";

/**
 * Base recipe: "Arroz con pollo" — complete, valid recipe with Thermomix params.
 * Includes almendras (nuts) so modification test case 2 has something to remove.
 */
export const BASE_RECIPE: GeneratedRecipe = {
  schemaVersion: "1.0",
  suggestedName: "Arroz con Pollo a la Mexicana",
  description:
    "Un clásico arroz con pollo preparado en el Thermomix, con verduras frescas y especias mexicanas.",
  measurementSystem: "metric",
  language: "es",
  ingredients: [
    { name: "pollo", quantity: 600, unit: "g" },
    { name: "arroz", quantity: 300, unit: "g" },
    { name: "cebolla", quantity: 1, unit: "unidad" },
    { name: "ajo", quantity: 3, unit: "dientes" },
    { name: "tomate", quantity: 2, unit: "unidades" },
    { name: "caldo de pollo", quantity: 500, unit: "ml" },
    { name: "almendras", quantity: 50, unit: "g" },
    { name: "pimiento rojo", quantity: 1, unit: "unidad" },
    { name: "aceite de oliva", quantity: 20, unit: "ml" },
    { name: "sal", quantity: 1, unit: "cucharadita" },
    { name: "pimienta", quantity: 0.5, unit: "cucharadita" },
    { name: "comino", quantity: 1, unit: "cucharadita" },
  ],
  steps: [
    {
      order: 1,
      instruction: "Picar la cebolla, el ajo y el pimiento rojo.",
      ingredientsUsed: ["cebolla", "ajo", "pimiento rojo"],
      thermomixTime: 5,
      thermomixTemp: null,
      thermomixSpeed: "5",
    },
    {
      order: 2,
      instruction: "Sofreír las verduras picadas con aceite de oliva.",
      ingredientsUsed: ["aceite de oliva"],
      thermomixTime: 300,
      thermomixTemp: "100°C",
      thermomixSpeed: "Reverse",
    },
    {
      order: 3,
      instruction: "Añadir el pollo cortado en trozos y dorar.",
      ingredientsUsed: ["pollo"],
      thermomixTime: 480,
      thermomixTemp: "120°C",
      thermomixSpeed: "Reverse",
    },
    {
      order: 4,
      instruction:
        "Agregar el arroz, tomate triturado, caldo, especias y almendras.",
      ingredientsUsed: [
        "arroz",
        "tomate",
        "caldo de pollo",
        "almendras",
        "sal",
        "pimienta",
        "comino",
      ],
      thermomixTime: 1200,
      thermomixTemp: "100°C",
      thermomixSpeed: "Reverse",
    },
    {
      order: 5,
      instruction: "Servir y decorar con almendras tostadas.",
      ingredientsUsed: ["almendras"],
      thermomixTime: null,
      thermomixTemp: null,
      thermomixSpeed: null,
    },
  ],
  totalTime: 45,
  difficulty: "medium",
  portions: 4,
  tags: [],
};

/**
 * Conversation history for orchestrator test case 5 (modify_recipe).
 * Provides enough context to know a recipe was recently generated.
 */
export const RECIPE_CONVERSATION_HISTORY: AIMessage[] = [
  { role: "user", content: "Hazme un arroz con pollo" },
  {
    role: "assistant",
    content:
      "¡Listo! Te preparé un delicioso arroz con pollo para 4 personas con Thermomix.",
  },
];
