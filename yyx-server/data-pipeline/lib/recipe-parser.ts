/**
 * Recipe Parser
 *
 * Parses bilingual recipe markdown into ParsedRecipeData using OpenAI gpt-4.1-mini
 * with structured output. Source-agnostic: accepts markdown from Notion exports,
 * AI-generated content, hand-written files, or web scrapes — extracts what's
 * present and leaves optional fields null/empty when absent.
 *
 * ParsedRecipeData is the format-agnostic boundary between source and pipeline:
 * everything downstream (entity resolution, DB writes, Spain adaptation) consumes
 * this shape and doesn't care where it came from.
 */

import { Logger } from './logger.ts';
import { parseJsonFromLLM } from './utils.ts';

// Shared speed enum used in multiple places
const speedEnum = [
  'spoon',
  0.5,
  1,
  1.5,
  2,
  2.5,
  3,
  3.5,
  4,
  4.5,
  5,
  5.5,
  6,
  6.5,
  7,
  7.5,
  8,
  8.5,
  9,
  9.5,
  10,
  null,
];

const temperatureEnum = [
  37,
  40,
  45,
  50,
  55,
  60,
  65,
  70,
  75,
  80,
  85,
  90,
  95,
  98,
  100,
  105,
  110,
  115,
  120,
  'Varoma',
  130,
  140,
  150,
  160,
  170,
  175,
  185,
  195,
  200,
  205,
  212,
  220,
  230,
  240,
  250,
  null,
];

const measurementUnitEnum = [
  'clove',
  'cup',
  'g',
  'kg',
  'l',
  'lb',
  'leaf',
  'ml',
  'oz',
  'piece',
  'pinch',
  'slice',
  'sprig',
  'taste',
  'tbsp',
  'tsp',
  'unit',
];

// ─── Meal-planning enums (single source for JSON schema + validator) ───
//
// Each enum is the authoritative list of allowed values for a meal-planning
// field. The JSON schema spreads these into its `enum` arrays and the
// runtime validator uses isInArray() against the same constants, so adding
// a value requires editing exactly one place.

const PLANNER_ROLES = [
  'main',
  'side',
  'dessert',
  'beverage',
  'snack',
  'condiment',
  'pantry',
] as const;
type PlannerRole = (typeof PLANNER_ROLES)[number];

const EQUIPMENT_TAGS = ['thermomix', 'air_fryer', 'oven', 'stovetop'] as const;
type EquipmentTag = (typeof EQUIPMENT_TAGS)[number];

const MEAL_COMPONENTS = ['protein', 'carb', 'veg', 'snack'] as const;
type MealComponent = (typeof MEAL_COMPONENTS)[number];

const COOKING_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
type CookingLevel = (typeof COOKING_LEVELS)[number];

const THERMOMIX_MODES = ['open_cooking', 'steaming'] as const;
type ThermomixMode = (typeof THERMOMIX_MODES)[number];

function isInArray<T extends string>(value: unknown, arr: readonly T[]): value is T {
  return typeof value === 'string' && (arr as readonly string[]).includes(value);
}

/** JSON Schema for OpenAI structured output - mirrors edge function */
const recipeJsonSchema = {
  name: 'recipe',
  schema: {
    type: 'object',
    properties: {
      nameEn: { type: 'string', description: 'English recipe name' },
      nameEs: { type: 'string', description: 'Spanish recipe name.' },
      totalTime: { type: 'number', description: 'Total time in MINUTES.' },
      prepTime: { type: 'number', description: 'Preparation time in MINUTES.' },
      difficulty: {
        type: 'string',
        description: 'Difficulty level of the recipe in English',
        enum: ['easy', 'medium', 'hard'],
      },
      portions: { type: 'number', description: 'Number of portions the recipe makes.' },
      tipsAndTricksEn: { type: 'string', description: 'English tips section.' },
      tipsAndTricksEs: { type: 'string', description: 'Spanish tips section.' },
      kitchenTools: {
        type: 'array',
        description:
          'List of the kitchen tools for the recipe found in the Utensilios y herramientas utiles or Kitchen tools section.',
        items: {
          type: 'object',
          properties: {
            nameEn: { type: 'string', description: 'English kitchen tool name, capitalize first letter only (e.g., "Airtight container", "Rolling pin", "Baking tray").' },
            nameEs: { type: 'string', description: 'Spanish kitchen tool name, capitalize first letter only (e.g., "Recipiente hermético", "Rodillo", "Bandeja de hornear").' },
            displayOrder: {
              type: 'number',
              description: '1-based index indicating the order of the kitchen tool.',
            },
            notesEn: {
              type: 'string',
              description: 'Additional notes about the kitchen tool in English.',
            },
            notesEs: {
              type: 'string',
              description: 'Additional notes about the kitchen tool in Spanish.',
            },
          },
          required: ['nameEn', 'nameEs', 'displayOrder', 'notesEn', 'notesEs'],
          additionalProperties: false,
        },
      },
      ingredients: {
        type: 'array',
        description: 'List of the ingredients required for the recipe.',
        items: {
          type: 'object',
          properties: {
            ingredient: {
              type: 'object',
              description: 'Ingredient details',
              properties: {
                nameEn: {
                  type: 'string',
                  description:
                    'The BASE ingredient name in English, singular. No quantities, no prep (fresh, chopped, diced), no form (cloves, sprigs, slices). E.g., "dientes de ajo" → "garlic", "ramita de romero fresco" → "rosemary", "miga de pan blanco" → "white bread crumbs".',
                },
                pluralNameEn: {
                  type: 'string',
                  description:
                    'The PLURAL form of the base ingredient name in English. E.g., "garlic" → "garlic", "tomato" → "tomatoes", "bread crumb" → "bread crumbs".',
                },
                nameEs: {
                  type: 'string',
                  description:
                    'The BASE ingredient name in Spanish, singular. No quantities, no prep (fresco, picado), no form (dientes, ramitas, rebanadas). E.g., "dientes de ajo" → "ajo", "ramita de romero fresco" → "romero", "miga de pan blanco" → "miga de pan".',
                },
                pluralNameEs: {
                  type: 'string',
                  description:
                    'The PLURAL form of the base ingredient name in Spanish. E.g., "ajo" → "ajos", "tomate" → "tomates".',
                },
              },
              required: ['nameEn', 'nameEs', 'pluralNameEn', 'pluralNameEs'],
              additionalProperties: false,
            },
            quantity: { type: 'number', description: 'Quantity of the ingredient.' },
            measurementUnitID: {
              type: 'string',
              description: 'The measurement unit of the ingredient if any.',
              enum: measurementUnitEnum,
              default: 'unit',
            },
            notesEn: {
              type: 'string',
              description: 'Any additional preparation notes in English.',
            },
            notesEs: {
              type: 'string',
              description: 'Any additional preparation notes in Spanish.',
            },
            tipEn: {
              type: 'string',
              description: 'Any tip included in the ingredient in English.',
            },
            tipEs: {
              type: 'string',
              description: 'Any tip included in the ingredient in Spanish.',
            },
            recipeSectionEn: {
              type: 'string',
              description:
                'If the recipe has multiple components, the title of section if found, otherwise: Main',
            },
            recipeSectionEs: {
              type: 'string',
              description:
                'If the recipe has multiple components, the title of section if found, otherwise: Principal',
            },
            displayOrder: {
              type: 'number',
              description: '1-based index indicating the order of the ingredient.',
            },
          },
          required: [
            'quantity',
            'measurementUnitID',
            'ingredient',
            'notesEn',
            'notesEs',
            'tipEn',
            'tipEs',
            'recipeSectionEn',
            'recipeSectionEs',
            'displayOrder',
          ],
          additionalProperties: false,
        },
      },
      steps: {
        type: 'array',
        description: 'List of steps.',
        items: {
          type: 'object',
          properties: {
            order: {
              type: 'number',
              description: '1-based index indicating the order of the instruction.',
            },
            instructionEn: { type: 'string', description: 'Full instruction text in English.' },
            instructionEs: { type: 'string', description: 'Full instruction text in Spanish.' },
            thermomixTime: {
              type: ['number', 'null'],
              description: 'Time in seconds, extracted from thermomix patterns.',
            },
            thermomixTemperature: {
              type: ['number', 'string', 'null'],
              description: 'Temperature extracted from thermomix patterns. Null if not found.',
              enum: temperatureEnum,
            },
            thermomixTemperatureUnit: {
              type: ['string', 'null'],
              description: 'Temperature unit in C or F, if it exists, null otherwise',
              enum: ['C', 'F', null],
            },
            thermomixSpeed: {
              type: ['object', 'null'],
              description: 'Speed section extracted from thermomix patterns.',
              properties: {
                type: {
                  type: 'string',
                  enum: ['single', 'range'],
                  description: "Type of speed, either 'single' or 'range'.",
                },
                value: {
                  type: ['number', 'string', 'null'],
                  enum: speedEnum,
                  description: 'Speed value for single type, null for range.',
                },
                start: {
                  type: ['number', 'string', 'null'],
                  enum: speedEnum,
                  description: 'Start value for range type, null for single.',
                },
                end: {
                  type: ['number', 'string', 'null'],
                  enum: speedEnum,
                  description: 'End value for range type, null for single.',
                },
              },
              required: ['type', 'value', 'start', 'end'],
              additionalProperties: false,
            },
            thermomixIsBladeReversed: {
              type: ['boolean', 'null'],
              description: 'Reverse blade extracted from thermomix patterns.',
            },
            ingredients: {
              type: 'array',
              description: 'List of ingredients used in this step.',
              items: {
                type: 'object',
                properties: {
                  ingredient: {
                    type: 'object',
                    description: 'Ingredient details',
                    properties: {
                      nameEn: {
                        type: 'string',
                        description: 'Only the ingredient name (in English.)',
                      },
                      pluralNameEn: {
                        type: 'string',
                        description: 'Only the plural ingredient name (in English.)',
                      },
                      nameEs: {
                        type: 'string',
                        description: 'Only the ingredient name (in Spanish)',
                      },
                      pluralNameEs: {
                        type: 'string',
                        description: 'Only the plural ingredient name (in Spanish)',
                      },
                    },
                    required: ['nameEn', 'nameEs', 'pluralNameEn', 'pluralNameEs'],
                    additionalProperties: false,
                  },
                  quantity: { type: 'number', description: 'Quantity of the ingredient.' },
                  measurementUnitID: {
                    type: 'string',
                    description: 'The measurement unit.',
                    enum: measurementUnitEnum,
                    default: 'unit',
                  },
                  displayOrder: {
                    type: 'number',
                    description: '1-based index of the ingredient in this step.',
                  },
                },
                required: ['ingredient', 'quantity', 'measurementUnitID', 'displayOrder'],
                additionalProperties: false,
              },
            },
            tipEn: { type: 'string', description: 'Tip for this recipe step in English.' },
            tipEs: { type: 'string', description: 'Tip for this recipe step in Spanish.' },
            recipeSectionEn: {
              type: 'string',
              description: 'Section title in English, default: Main',
            },
            recipeSectionEs: {
              type: 'string',
              description: 'Section title in Spanish, default: Principal',
            },
            thermomixMode: {
              type: ['string', 'null'],
              description:
                'Thermomix cooking mode. Set "steaming" when the step uses the Varoma accessory (steam tray). Set "open_cooking" when the step explicitly indicates an open lid — Spanish phrasings include "sin tapa", "tapa abierta", "destapa", "retira la tapa", "sin la tapa"; English equivalents include "uncovered", "lid off". Use null when uncertain or not specified.',
              enum: [...THERMOMIX_MODES, null],
            },
            timerSeconds: {
              type: ['number', 'null'],
              description:
                'Duration in seconds of a non-Thermomix timed action in this step (e.g., baking, resting, preheating). Extract from phrases like "hornear 30 min" → 1800, "reposar 10 minutos" → 600. If thermomixTime is set for this step, set timerSeconds to null.',
            },
          },
          required: [
            'order',
            'thermomixTime',
            'thermomixTemperature',
            'thermomixTemperatureUnit',
            'thermomixSpeed',
            'thermomixIsBladeReversed',
            'ingredients',
            'instructionEn',
            'instructionEs',
            'tipEn',
            'tipEs',
            'recipeSectionEn',
            'recipeSectionEs',
            'thermomixMode',
            'timerSeconds',
          ],
          additionalProperties: false,
        },
      },
      tags: {
        type: 'array',
        description: 'List of all tags from both English and Spanish sections.',
        items: { type: 'string', description: 'Tag name without # prefix.' },
      },
      plannerRole: {
        type: ['string', 'null'],
        description:
          'Meal planner role. Extract from "Rol:" aside field. Null if not present.',
        enum: [...PLANNER_ROLES, null],
      },
      equipmentTags: {
        type: 'array',
        description:
          'Equipment required beyond standard cookware. Extract from "Equipo:" aside field (comma-separated). Empty array if not present.',
        items: { type: 'string', enum: [...EQUIPMENT_TAGS] },
      },
      mealComponents: {
        type: 'array',
        description:
          'Meal components this recipe provides. Extract from "Componentes:" aside field (comma-separated). Empty array if not present.',
        items: { type: 'string', enum: [...MEAL_COMPONENTS] },
      },
      isCompleteMeal: {
        type: 'boolean',
        description:
          'Whether this recipe is a complete meal on its own. Extract from "Comida completa: Sí/No" aside field. Default false if not present.',
      },
      cookingLevel: {
        type: ['string', 'null'],
        description:
          'Cooking skill level required. Extract from "Nivel de cocina:" aside field. Null if not present.',
        enum: [...COOKING_LEVELS, null],
      },
      leftoversFriendly: {
        type: ['boolean', 'null'],
        description:
          'Whether this recipe keeps well as leftovers. Extract from "Apto para sobras: Sí/No" aside field. Null if not present.',
      },
      maxHouseholdSizeSupported: {
        type: ['number', 'null'],
        description:
          'Maximum household size this recipe can serve. Extract from "Porciones máximas:" aside field as an integer. Null if not present.',
      },
      batchFriendly: {
        type: ['boolean', 'null'],
        description:
          'Whether this recipe is suitable for batch cooking (make ahead in large quantities). Extract from "Batch cooking: Sí/No" aside field. Null if not present.',
      },
    },
    required: [
      'nameEn',
      'nameEs',
      'totalTime',
      'prepTime',
      'difficulty',
      'portions',
      'tipsAndTricksEn',
      'tipsAndTricksEs',
      'kitchenTools',
      'ingredients',
      'steps',
      'tags',
      'plannerRole',
      'equipmentTags',
      'mealComponents',
      'isCompleteMeal',
      'cookingLevel',
      'leftoversFriendly',
      'maxHouseholdSizeSupported',
      'batchFriendly',
    ],
    additionalProperties: false,
  },
  strict: true,
};

const systemPrompt = `
You are a recipe parser that converts recipe Markdown into structured JSON data. The input may come from a variety of sources (Notion exports, AI generation, hand-written, web scrapes). Be permissive about structure — extract what's present, leave optional fields null/empty/false when absent. Never invent content.

## Recipe Identity

The H1 heading (# Recipe Name) is the recipe name. It may be in Spanish OR English. Set nameEs to the Spanish name and nameEn to the English name; translate whichever is missing.

## Optional Conventions (use if present, ignore if absent)

Files may include a metadata header before the content with lines like:
  Recipe URL: ...
  Tags: X, Y, Z   ← USE this line for the tags field
  Status: ...      ← IGNORE
  Chat '25: ...    ← IGNORE

Recipes may use Spanish section headings (### Ingredientes / ### Procedimiento / ### Tips / ### Kitchen tools) or English (### Ingredients / ### Steps / ### Tips). Both are valid. If a two-language layout is present (e.g., "## Receta en Español" + "## English Recipe"), use both; if one side is empty, translate from the other.

Aside blocks (e.g., Notion <aside>…</aside> or Markdown blockquote callouts) commonly hold timing, difficulty, portions, and meal-planning metadata — extract from inside them when present.

## Tags

Extract tags ONLY from the metadata line at the top: "Tags: X, Y, Z" (with or without leading whitespace).
Split on commas or hyphens. Do NOT include tags from "- **Tags**" placeholder lines.
If no "Tags:" metadata line exists, or it is empty, return an EMPTY array. Do NOT invent or infer tags from content.

## Thermomix Patterns (Spanish)

Thermomix parameters appear inline in step text. Extract them:
- Time:        "X seg" → X seconds | "X min" → X×60 seconds
- Speed:       "vel X" where X is a number | "vel cuchara" → speed "spoon"
- Speed range: "vel 4-8" → range from 4 to 8
- Temperature: "X°C" (e.g., "90°C") | "Varoma" → temperature "Varoma"
- Reverse:     "giro a la izquierda" → thermomixIsBladeReversed: true

Example: "cocinar 10 min/90°C/giro a la izquierda/vel cuchara"
→ thermomixTime: 600, thermomixTemperature: 90, thermomixTemperatureUnit: "C",
  thermomixIsBladeReversed: true, thermomixSpeed: { type: "single", value: "spoon", start: null, end: null }

Example: "licúa 20 seg/vel 4-8, aumentando la velocidad progresivamente"
→ thermomixTime: 20, thermomixSpeed: { type: "range", value: null, start: 4, end: 8 }

## Missing Data

- totalTime / prepTime: extract from aside blocks ("Tiempo total: 15 mins", etc.). Values are ALWAYS in minutes (e.g., "15 mins" → 15, "1 hora" → 60). If missing, use 0.
- portions: extract from aside blocks ("Porciones: 4"). Must be a whole number of servings. If a weight is given instead (e.g., "200g", "1 kg"), use 4 as default. If missing, use 4.
- difficulty: extract from aside blocks ("Nivel de dificultad: fácil" → "easy", "medio/media" → "medium", "difícil" → "hard"). If missing, use "medium".
- If English content is empty or missing, translate the Spanish content to English.

## Meal Planning Metadata (from aside blocks, all optional)

Extract the following if present in aside blocks. Use null / [] / false as defaults when absent.

- plannerRole: "Rol: main" or "Role: main" → "main". Values: main, side, dessert, beverage, snack, condiment, pantry. Null if absent.
- equipmentTags: "Equipo: thermomix, air_fryer" or "Equipment: thermomix, air_fryer" → ["thermomix", "air_fryer"]. Values: thermomix, air_fryer, oven, stovetop. [] if absent.
- mealComponents: "Componentes: protein, carb" or "Components: protein, carb" → ["protein", "carb"]. Values: protein, carb, veg, snack. [] if absent.
- isCompleteMeal: "Comida completa: Sí/No" or "Complete meal: Yes/No" → true/false. Default false if absent.
- cookingLevel: "Nivel de cocina: beginner" or "Cooking level: beginner" → "beginner". Values: beginner, intermediate, advanced. Null if absent.
- leftoversFriendly: "Apto para sobras: Sí/No" or "Good for leftovers: Yes/No" → true/false. Null if absent.
- maxHouseholdSizeSupported: "Porciones máximas: 6" or "Max servings: 6" → 6 (integer). Null if absent.
- batchFriendly: "Batch cooking: Sí/No" or "Batch cooking: Yes/No" → true/false. Null if absent.

## Thermomix Mode and Step Timers

For each step, also set:
- thermomixMode:
  - "steaming" when the step uses the Varoma accessory (steam tray).
  - "open_cooking" when the step explicitly indicates an open lid. Spanish: "sin tapa", "tapa abierta", "destapa", "destapado/a", "retira la tapa", "sin la tapa", "quita la tapa". English: "uncovered", "lid off", "remove the lid".
  - null when uncertain or not specified — do NOT infer from absence of a "tapa" mention.
- timerSeconds: duration in seconds for non-Thermomix timed actions only. "hornear 30 min" → 1800. "reposar 10 minutos" → 600. If this step already has thermomixTime set, set timerSeconds to null.

## Ingredient Names

Use BASE ingredient names only — strip prep methods, forms, and freshness from the name:
- "dientes de ajo" → nameEs: "ajo", nameEn: "garlic" (NOT "garlic clove")
- "ramita de romero fresco" → nameEs: "romero", nameEn: "rosemary" (NOT "fresh rosemary sprig")
- "miga de pan blanco" → nameEs: "miga de pan", nameEn: "bread crumbs" (NOT "white bread crumb")
- "pechuga de pollo deshuesada" → nameEs: "pechuga de pollo", nameEn: "chicken breast"

Put prep/form details (fresh, chopped, sliced, cloves, sprigs) in the ingredient's notesEn/notesEs fields instead.
Plural names must be actual plurals: "bread crumb" → "bread crumbs", "tomato" → "tomatoes".

## Kitchen Tool Names

Use Title Case for English names: "Airtight Container", "Rolling Pin", "Baking Tray".
Capitalize first letter for Spanish names: "Recipiente hermético", "Rodillo".

## Critical Rules

DO NOT make up recipe content (ingredients, steps, tools, tips).
DO NOT include anything not found in the markdown.
DO translate names and content to English when only Spanish is provided.
`;

export interface ParsedRecipeData {
  nameEn: string;
  nameEs: string;
  totalTime: number;
  prepTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  portions: number;
  tipsAndTricksEn: string;
  tipsAndTricksEs: string;
  kitchenTools: Array<{
    nameEn: string;
    nameEs: string;
    displayOrder: number;
    notesEn: string;
    notesEs: string;
  }>;
  ingredients: Array<{
    ingredient: {
      nameEn: string;
      nameEs: string;
      pluralNameEn: string;
      pluralNameEs: string;
    };
    quantity: number;
    measurementUnitID: string;
    notesEn: string;
    notesEs: string;
    tipEn: string;
    tipEs: string;
    recipeSectionEn: string;
    recipeSectionEs: string;
    displayOrder: number;
  }>;
  steps: Array<{
    order: number;
    instructionEn: string;
    instructionEs: string;
    thermomixTime: number | null;
    thermomixTemperature: number | string | null;
    thermomixTemperatureUnit: string | null;
    thermomixSpeed: {
      type: 'single' | 'range';
      value: number | string | null;
      start: number | string | null;
      end: number | string | null;
    } | null;
    thermomixIsBladeReversed: boolean | null;
    thermomixMode: ThermomixMode | null;
    timerSeconds: number | null;
    ingredients: Array<{
      ingredient: {
        nameEn: string;
        nameEs: string;
        pluralNameEn: string;
        pluralNameEs: string;
      };
      quantity: number;
      measurementUnitID: string;
      displayOrder: number;
    }>;
    tipEn: string;
    tipEs: string;
    recipeSectionEn: string;
    recipeSectionEs: string;
  }>;
  tags: string[];
  plannerRole: PlannerRole | null;
  equipmentTags: EquipmentTag[];
  mealComponents: MealComponent[];
  isCompleteMeal: boolean;
  cookingLevel: CookingLevel | null;
  leftoversFriendly: boolean | null;
  maxHouseholdSizeSupported: number | null;
  batchFriendly: boolean | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || isNumber(value);
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isDifficulty(value: unknown): value is ParsedRecipeData['difficulty'] {
  return value === 'easy' || value === 'medium' || value === 'hard';
}

function getField(obj: Record<string, unknown>, key: string): unknown {
  return obj[key];
}

function assertStringField(obj: Record<string, unknown>, key: string): void {
  if (!isString(getField(obj, key))) {
    throw new Error(`Invalid recipe parser output: "${key}" must be a string`);
  }
}

function assertNumberField(obj: Record<string, unknown>, key: string): void {
  if (!isNumber(getField(obj, key))) {
    throw new Error(`Invalid recipe parser output: "${key}" must be a number`);
  }
}

function assertArrayField(obj: Record<string, unknown>, key: string): unknown[] {
  const value = getField(obj, key);
  if (!Array.isArray(value)) {
    throw new Error(`Invalid recipe parser output: "${key}" must be an array`);
  }
  return value;
}

function validateKitchenTools(kitchenTools: unknown[]): void {
  for (const item of kitchenTools) {
    if (!isObject(item)) {
      throw new Error('Invalid recipe parser output: "kitchenTools" entries must be objects');
    }
    assertStringField(item, 'nameEn');
    assertStringField(item, 'nameEs');
    assertNumberField(item, 'displayOrder');
    assertStringField(item, 'notesEn');
    assertStringField(item, 'notesEs');
  }
}

function validateIngredientRef(value: unknown, sourceField: string): void {
  if (!isObject(value)) {
    throw new Error(`Invalid recipe parser output: "${sourceField}.ingredient" must be an object`);
  }
  assertStringField(value, 'nameEn');
  assertStringField(value, 'nameEs');
  assertStringField(value, 'pluralNameEn');
  assertStringField(value, 'pluralNameEs');
}

function validateIngredients(ingredients: unknown[]): void {
  for (const ingredient of ingredients) {
    if (!isObject(ingredient)) {
      throw new Error('Invalid recipe parser output: "ingredients" entries must be objects');
    }
    validateIngredientRef(getField(ingredient, 'ingredient'), 'ingredients');
    assertNumberField(ingredient, 'quantity');
    assertStringField(ingredient, 'measurementUnitID');
    assertStringField(ingredient, 'notesEn');
    assertStringField(ingredient, 'notesEs');
    assertStringField(ingredient, 'tipEn');
    assertStringField(ingredient, 'tipEs');
    assertStringField(ingredient, 'recipeSectionEn');
    assertStringField(ingredient, 'recipeSectionEs');
    assertNumberField(ingredient, 'displayOrder');
  }
}

function validateStepSpeed(step: Record<string, unknown>): void {
  const speed = getField(step, 'thermomixSpeed');
  if (speed === null) {
    return;
  }
  if (!isObject(speed)) {
    throw new Error('Invalid recipe parser output: "thermomixSpeed" must be an object or null');
  }

  const speedType = getField(speed, 'type');
  if (speedType !== 'single' && speedType !== 'range') {
    throw new Error('Invalid recipe parser output: "thermomixSpeed.type" must be single or range');
  }

  const value = getField(speed, 'value');
  const start = getField(speed, 'start');
  const end = getField(speed, 'end');
  if (!isNumberOrNull(value) && !isStringOrNull(value)) {
    throw new Error('Invalid recipe parser output: "thermomixSpeed.value" has invalid type');
  }
  if (!isNumberOrNull(start) && !isStringOrNull(start)) {
    throw new Error('Invalid recipe parser output: "thermomixSpeed.start" has invalid type');
  }
  if (!isNumberOrNull(end) && !isStringOrNull(end)) {
    throw new Error('Invalid recipe parser output: "thermomixSpeed.end" has invalid type');
  }
}

function validateStepIngredients(step: Record<string, unknown>): void {
  const stepIngredients = assertArrayField(step, 'ingredients');
  for (const ingredient of stepIngredients) {
    if (!isObject(ingredient)) {
      throw new Error('Invalid recipe parser output: step ingredient entries must be objects');
    }
    validateIngredientRef(getField(ingredient, 'ingredient'), 'steps[].ingredients');
    assertNumberField(ingredient, 'quantity');
    assertStringField(ingredient, 'measurementUnitID');
    assertNumberField(ingredient, 'displayOrder');
  }
}

function validateSteps(steps: unknown[]): void {
  for (const step of steps) {
    if (!isObject(step)) {
      throw new Error('Invalid recipe parser output: "steps" entries must be objects');
    }
    assertNumberField(step, 'order');
    assertStringField(step, 'instructionEn');
    assertStringField(step, 'instructionEs');
    assertStringField(step, 'tipEn');
    assertStringField(step, 'tipEs');
    assertStringField(step, 'recipeSectionEn');
    assertStringField(step, 'recipeSectionEs');

    if (!isNumberOrNull(getField(step, 'thermomixTime'))) {
      throw new Error('Invalid recipe parser output: "thermomixTime" must be a number or null');
    }

    const temperature = getField(step, 'thermomixTemperature');
    if (!isNumberOrNull(temperature) && !isStringOrNull(temperature)) {
      throw new Error(
        'Invalid recipe parser output: "thermomixTemperature" must be a number, string, or null',
      );
    }

    const temperatureUnit = getField(step, 'thermomixTemperatureUnit');
    if (!isStringOrNull(temperatureUnit)) {
      throw new Error(
        'Invalid recipe parser output: "thermomixTemperatureUnit" must be a string or null',
      );
    }

    const bladeReversed = getField(step, 'thermomixIsBladeReversed');
    if (bladeReversed !== null && typeof bladeReversed !== 'boolean') {
      throw new Error(
        'Invalid recipe parser output: "thermomixIsBladeReversed" must be a boolean or null',
      );
    }

    validateStepSpeed(step);
    validateStepIngredients(step);

    const thermomixMode = getField(step, 'thermomixMode');
    if (thermomixMode !== null && !isInArray(thermomixMode, THERMOMIX_MODES)) {
      throw new Error(
        `Invalid recipe parser output: "thermomixMode" must be one of ${THERMOMIX_MODES.join(', ')}, or null`,
      );
    }

    const timerSeconds = getField(step, 'timerSeconds');
    if (!isNumberOrNull(timerSeconds)) {
      throw new Error('Invalid recipe parser output: "timerSeconds" must be a number or null');
    }
  }
}

function validateTags(tags: unknown[]): void {
  for (const tag of tags) {
    if (!isString(tag)) {
      throw new Error('Invalid recipe parser output: all "tags" must be strings');
    }
  }
}

function validateParsedRecipeData(data: unknown): ParsedRecipeData {
  if (!isObject(data)) {
    throw new Error('Invalid recipe parser output: expected a JSON object');
  }

  assertStringField(data, 'nameEn');
  assertStringField(data, 'nameEs');
  assertNumberField(data, 'totalTime');
  assertNumberField(data, 'prepTime');
  assertNumberField(data, 'portions');
  assertStringField(data, 'tipsAndTricksEn');
  assertStringField(data, 'tipsAndTricksEs');

  if (!isDifficulty(getField(data, 'difficulty'))) {
    throw new Error('Invalid recipe parser output: "difficulty" must be easy, medium, or hard');
  }

  const kitchenTools = assertArrayField(data, 'kitchenTools');
  const ingredients = assertArrayField(data, 'ingredients');
  const steps = assertArrayField(data, 'steps');
  const tags = assertArrayField(data, 'tags');

  validateKitchenTools(kitchenTools);
  validateIngredients(ingredients);
  validateSteps(steps);
  validateTags(tags);

  // plannerRole: string or null, restricted enum
  const plannerRole = getField(data, 'plannerRole');
  if (plannerRole !== null && !isInArray(plannerRole, PLANNER_ROLES)) {
    throw new Error(
      `Invalid recipe parser output: "plannerRole" must be one of ${PLANNER_ROLES.join(', ')}, or null`,
    );
  }

  // equipmentTags: array of valid strings
  const equipmentTags = assertArrayField(data, 'equipmentTags');
  for (const tag of equipmentTags) {
    if (!isInArray(tag, EQUIPMENT_TAGS)) {
      throw new Error(`Invalid recipe parser output: "equipmentTags" contains invalid value "${tag}"`);
    }
  }

  // mealComponents: array of valid strings
  const mealComponents = assertArrayField(data, 'mealComponents');
  for (const mc of mealComponents) {
    if (!isInArray(mc, MEAL_COMPONENTS)) {
      throw new Error(`Invalid recipe parser output: "mealComponents" contains invalid value "${mc}"`);
    }
  }

  // isCompleteMeal: boolean
  if (typeof getField(data, 'isCompleteMeal') !== 'boolean') {
    throw new Error('Invalid recipe parser output: "isCompleteMeal" must be a boolean');
  }

  // cookingLevel: string or null
  const cookingLevel = getField(data, 'cookingLevel');
  if (cookingLevel !== null && !isInArray(cookingLevel, COOKING_LEVELS)) {
    throw new Error(
      `Invalid recipe parser output: "cookingLevel" must be one of ${COOKING_LEVELS.join(', ')}, or null`,
    );
  }

  // leftoversFriendly: boolean or null
  const leftoversFriendly = getField(data, 'leftoversFriendly');
  if (leftoversFriendly !== null && typeof leftoversFriendly !== 'boolean') {
    throw new Error('Invalid recipe parser output: "leftoversFriendly" must be a boolean or null');
  }

  // maxHouseholdSizeSupported: number or null
  if (!isNumberOrNull(getField(data, 'maxHouseholdSizeSupported'))) {
    throw new Error(
      'Invalid recipe parser output: "maxHouseholdSizeSupported" must be a number or null',
    );
  }

  // batchFriendly: boolean or null
  const batchFriendly = getField(data, 'batchFriendly');
  if (batchFriendly !== null && typeof batchFriendly !== 'boolean') {
    throw new Error('Invalid recipe parser output: "batchFriendly" must be a boolean or null');
  }

  return data as unknown as ParsedRecipeData;
}

function extractContentText(responseData: unknown): string | null {
  if (!isObject(responseData)) {
    return null;
  }

  const outputText = getField(responseData, 'output_text');
  if (isString(outputText) && outputText.trim()) {
    return outputText;
  }

  const output = getField(responseData, 'output');
  if (!Array.isArray(output)) {
    return null;
  }

  for (const outputEntry of output) {
    if (!isObject(outputEntry)) {
      continue;
    }

    const content = getField(outputEntry, 'content');
    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content) {
      if (!isObject(part)) {
        continue;
      }
      const text = getField(part, 'text');
      if (isString(text) && text.trim()) {
        return text;
      }
    }
  }

  return null;
}

/** Parse recipe markdown text into ParsedRecipeData using OpenAI structured output. */
export async function parseRecipe(
  markdown: string,
  openaiApiKey: string,
  logger: Logger,
): Promise<ParsedRecipeData> {
  logger.info('Calling OpenAI to parse recipe markdown...');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.3,
      max_output_tokens: 10000,
      text: {
        format: {
          type: 'json_schema',
          name: 'ParseRecipe',
          schema: recipeJsonSchema.schema,
        },
      },
      input: markdown,
      instructions: systemPrompt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const responseData = await response.json();
  const content = extractContentText(responseData);

  if (!content) {
    throw new Error('No content in OpenAI response');
  }

  const parsed = validateParsedRecipeData(parseJsonFromLLM(content));
  logger.success(`Parsed recipe: "${parsed.nameEn}" / "${parsed.nameEs}"`);
  return parsed;
}
