/**
 * Recipe Test Data Factory
 *
 * Generates realistic recipe test data for use in tests.
 *
 * FOR AI AGENTS:
 * - Use these factories instead of manually creating test data
 * - Override only the fields relevant to your test
 * - Use createList() for tests needing multiple items
 *
 * @example
 * ```typescript
 * import { recipeFactory } from '@/test/factories';
 *
 * // Create a single recipe with defaults
 * const recipe = recipeFactory.create();
 *
 * // Create with specific overrides
 * const easyRecipe = recipeFactory.create({ difficulty: RecipeDifficulty.EASY });
 *
 * // Create multiple recipes
 * const recipes = recipeFactory.createList(10);
 *
 * // Create related entities
 * const ingredient = recipeFactory.createIngredient();
 * const step = recipeFactory.createStep();
 * const tag = recipeFactory.createTag();
 * ```
 */

import type {
  Recipe,
  RecipeIngredient,
  RecipeStep,
  RecipeTag,
  RecipeUsefulItem,
  MeasurementUnit,
  RecipeStepIngredient,
} from '@/types/recipe.types';
import { RecipeDifficulty } from '@/types/recipe.types';
import { VALID_SPEEDS, VALID_TEMPERATURES } from '@/types/thermomix.types';

// ============================================================
// COUNTER FOR UNIQUE IDS
// ============================================================

let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `test-id-${idCounter}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Resets the ID counter for deterministic test behavior.
 * Call this in beforeEach to ensure tests don't depend on execution order.
 */
export function resetIdCounter(): void {
  idCounter = 0;
}

// ============================================================
// SAMPLE DATA POOLS
// ============================================================

const recipeNames = [
  'Creamy Pasta Carbonara',
  'Spicy Thai Green Curry',
  'Classic French Omelette',
  'Mediterranean Quinoa Salad',
  'Homemade Pizza Margherita',
  'Beef Tacos with Guacamole',
  'Japanese Miso Ramen',
  'Indian Butter Chicken',
  'Greek Moussaka',
  'Vietnamese Pho',
];

const ingredientNames = [
  'All-purpose flour',
  'Olive oil',
  'Garlic cloves',
  'Onion',
  'Salt',
  'Black pepper',
  'Chicken breast',
  'Heavy cream',
  'Parmesan cheese',
  'Fresh basil',
  'Tomatoes',
  'Eggs',
  'Butter',
  'Lemon juice',
  'Soy sauce',
];

const tagNames = [
  'Quick & Easy',
  'Vegetarian',
  'Gluten-Free',
  'Low Carb',
  'High Protein',
  'Kid-Friendly',
  'Comfort Food',
  'Healthy',
  'Budget-Friendly',
  'Date Night',
];

const tagCategories = ['diet', 'cuisine', 'occasion', 'difficulty', 'time'];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function randomElement<T>(array: readonly T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============================================================
// MEASUREMENT UNIT FACTORY
// ============================================================

export function createMeasurementUnit(overrides?: Partial<MeasurementUnit>): MeasurementUnit {
  const units: MeasurementUnit[] = [
    { id: generateId(), type: 'volume', system: 'metric', name: 'milliliter', symbol: 'ml', symbolPlural: 'ml' },
    { id: generateId(), type: 'volume', system: 'metric', name: 'liter', symbol: 'L', symbolPlural: 'L' },
    { id: generateId(), type: 'weight', system: 'metric', name: 'gram', symbol: 'g', symbolPlural: 'g' },
    { id: generateId(), type: 'weight', system: 'metric', name: 'kilogram', symbol: 'kg', symbolPlural: 'kg' },
    { id: generateId(), type: 'unit', system: 'universal', name: 'piece', symbol: 'pc', symbolPlural: 'pcs' },
    { id: generateId(), type: 'volume', system: 'imperial', name: 'cup', symbol: 'cup', symbolPlural: 'cups' },
    { id: generateId(), type: 'volume', system: 'imperial', name: 'tablespoon', symbol: 'tbsp', symbolPlural: 'tbsp' },
    { id: generateId(), type: 'volume', system: 'imperial', name: 'teaspoon', symbol: 'tsp', symbolPlural: 'tsp' },
  ];

  return {
    ...randomElement(units),
    ...overrides,
  };
}

// ============================================================
// INGREDIENT FACTORY
// ============================================================

export function createIngredient(overrides?: Partial<RecipeIngredient>): RecipeIngredient {
  const name = randomElement(ingredientNames);
  const quantity = randomInt(1, 500).toString();
  const unit = createMeasurementUnit();

  return {
    id: generateId(),
    name,
    pluralName: name + 's',
    pictureUrl: `https://images.test.com/ingredients/${name.toLowerCase().replace(/\s+/g, '-')}.jpg`,
    quantity,
    measurementUnit: unit,
    formattedQuantity: quantity,
    formattedUnit: unit.symbol,
    notes: Math.random() > 0.7 ? 'Finely chopped' : undefined,
    displayOrder: randomInt(1, 20),
    optional: Math.random() > 0.8,
    recipeSection: Math.random() > 0.5 ? 'Main Ingredients' : 'For the Sauce',
    ...overrides,
  };
}

export function createIngredientList(count: number): RecipeIngredient[] {
  return Array.from({ length: count }, (_, index) =>
    createIngredient({ displayOrder: index + 1 })
  );
}

// ============================================================
// STEP INGREDIENT FACTORY
// ============================================================

export function createStepIngredient(overrides?: Partial<RecipeStepIngredient>): RecipeStepIngredient {
  const name = randomElement(ingredientNames);
  const quantity = randomInt(1, 100).toString();
  const unit = createMeasurementUnit();

  return {
    id: generateId(),
    name,
    pluralName: name + 's',
    pictureUrl: `https://images.test.com/ingredients/${name.toLowerCase().replace(/\s+/g, '-')}.jpg`,
    quantity,
    measurementUnit: unit,
    formattedQuantity: quantity,
    formattedUnit: unit.symbol,
    displayOrder: randomInt(1, 10),
    optional: false,
    ...overrides,
  };
}

// ============================================================
// STEP FACTORY
// ============================================================

const stepInstructions = [
  'Preheat the oven to 180°C (350°F).',
  'Chop all vegetables into small cubes.',
  'Heat olive oil in a large pan over medium heat.',
  'Add the garlic and sauté for 1 minute until fragrant.',
  'Season with salt and pepper to taste.',
  'Simmer for 15-20 minutes, stirring occasionally.',
  'Transfer to a serving dish and garnish with fresh herbs.',
  'Let rest for 5 minutes before serving.',
  'Mix all dry ingredients in a large bowl.',
  'Whisk the eggs until light and fluffy.',
];

export function createStep(overrides?: Partial<RecipeStep>): RecipeStep {
  const temperatureUnit = Math.random() > 0.5 ? 'C' : 'F';
  const temperature = temperatureUnit === 'C'
    ? randomElement(VALID_TEMPERATURES.CELSIUS)
    : randomElement(VALID_TEMPERATURES.FAHRENHEIT);
  const speedValue = randomElement([...VALID_SPEEDS.NUMERIC, ...VALID_SPEEDS.SPECIAL]);

  return {
    id: generateId(),
    order: randomInt(1, 10),
    instruction: randomElement(stepInstructions),
    recipeSection: Math.random() > 0.5 ? 'Preparation' : null,
    thermomix: Math.random() > 0.7
      ? {
          time: randomInt(5, 30),
          speed: { type: 'single', value: speedValue },
          temperature,
          temperatureUnit,
          isBladeReversed: Math.random() > 0.5,
        }
      : undefined,
    ingredients: Math.random() > 0.5 ? [createStepIngredient()] : [],
    ...overrides,
  };
}

export function createStepList(count: number): RecipeStep[] {
  return Array.from({ length: count }, (_, index) =>
    createStep({ order: index + 1 })
  );
}

// ============================================================
// TAG FACTORY
// ============================================================

export function createTag(overrides?: Partial<RecipeTag>): RecipeTag {
  return {
    id: generateId(),
    name: randomElement(tagNames),
    categories: [randomElement(tagCategories)],
    ...overrides,
  };
}

export function createTagList(count: number): RecipeTag[] {
  const usedNames = new Set<string>();
  const tags: RecipeTag[] = [];

  while (tags.length < count && usedNames.size < tagNames.length) {
    const name = randomElement(tagNames);
    if (!usedNames.has(name)) {
      usedNames.add(name);
      tags.push(createTag({ name }));
    }
  }

  return tags;
}

// ============================================================
// USEFUL ITEM FACTORY
// ============================================================

const usefulItemNames = [
  'Large mixing bowl',
  'Whisk',
  'Cutting board',
  'Sharp knife',
  'Baking tray',
  'Measuring cups',
  'Food processor',
  'Spatula',
  'Thermomix',
  'Stand mixer',
];

export function createUsefulItem(overrides?: Partial<RecipeUsefulItem>): RecipeUsefulItem {
  const name = randomElement(usefulItemNames);

  return {
    id: generateId(),
    name,
    pictureUrl: `https://images.test.com/items/${name.toLowerCase().replace(/\s+/g, '-')}.jpg`,
    displayOrder: randomInt(1, 10),
    notes: Math.random() > 0.7 ? 'Optional but recommended' : '',
    ...overrides,
  };
}

// ============================================================
// RECIPE FACTORY
// ============================================================

export function createRecipe(overrides?: Partial<Recipe>): Recipe {
  const name = randomElement(recipeNames);
  const now = new Date().toISOString();
  const createdAt = new Date(Date.now() - randomInt(1, 365) * 24 * 60 * 60 * 1000).toISOString();

  return {
    id: generateId(),
    name,
    pictureUrl: `https://images.test.com/recipes/${name.toLowerCase().replace(/\s+/g, '-')}.jpg`,
    difficulty: randomElement([RecipeDifficulty.EASY, RecipeDifficulty.MEDIUM, RecipeDifficulty.HARD]),
    prepTime: randomInt(5, 30),
    totalTime: randomInt(15, 120),
    portions: randomInt(2, 8),
    steps: createStepList(randomInt(3, 8)),
    tipsAndTricks: Math.random() > 0.5 ? 'For best results, use room temperature ingredients.' : undefined,
    ingredients: createIngredientList(randomInt(4, 12)),
    tags: createTagList(randomInt(1, 4)),
    usefulItems: Math.random() > 0.5 ? [createUsefulItem()] : [],
    isPublished: true,
    createdAt,
    updatedAt: now,
    ...overrides,
  };
}

export function createRecipeList(count: number): Recipe[] {
  return Array.from({ length: count }, () => createRecipe());
}

// ============================================================
// PARTIAL RECIPE FACTORY (for API responses)
// ============================================================

export interface RecipeListItem {
  id: string;
  name: string;
  pictureUrl?: string;
  difficulty: RecipeDifficulty;
  prepTime: number | null;
  totalTime: number | null;
  portions?: number;
  isPublished: boolean;
}

export function createRecipeListItem(overrides?: Partial<RecipeListItem>): RecipeListItem {
  const recipe = createRecipe();
  return {
    id: recipe.id,
    name: recipe.name,
    pictureUrl: recipe.pictureUrl,
    difficulty: recipe.difficulty,
    prepTime: recipe.prepTime,
    totalTime: recipe.totalTime,
    portions: recipe.portions,
    isPublished: recipe.isPublished,
    ...overrides,
  };
}

// ============================================================
// FACTORY OBJECT EXPORT
// ============================================================

/**
 * Recipe factory object with all creation methods.
 *
 * FOR AI AGENTS: Use this object for all recipe-related test data.
 */
export const recipeFactory = {
  create: createRecipe,
  createList: createRecipeList,
  createListItem: createRecipeListItem,
  createIngredient,
  createIngredientList,
  createStep,
  createStepList,
  createTag,
  createTagList,
  createUsefulItem,
  createMeasurementUnit,
  createStepIngredient,
  resetIdCounter,
};
