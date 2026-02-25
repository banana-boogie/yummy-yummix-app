/**
 * Chat Mock Utilities
 *
 * Provides helper functions for mocking chat-related functionality in tests.
 *
 * FOR AI AGENTS:
 * - Use these helpers to mock SSE streaming and chat callbacks
 * - Always reset mocks between tests using jest.clearAllMocks()
 */

import type {
  IrmixyResponse,
  IrmixyStatus,
  RecipeCard,
  GeneratedRecipe,
  GeneratedIngredient,
  GeneratedStep,
  SafetyFlags,
} from '@/types/irmixy';
import type { UserRecipeSummary } from '@/services/customRecipeService';

// ============================================================
// EVENT SOURCE MOCK
// ============================================================

/**
 * Creates a mock EventSource for SSE streaming tests.
 * Use this to simulate server-sent events in chatService tests.
 */
export function createMockEventSource() {
  const listeners: Record<string, ((event: any) => void)[]> = {};

  return {
    addEventListener: jest.fn((event: string, callback: (event: any) => void) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(callback);
    }),
    removeEventListener: jest.fn((event: string, callback: (event: any) => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((cb) => cb !== callback);
      }
    }),
    close: jest.fn(),
    // Helper to trigger events in tests
    _trigger: (event: string, data: any) => {
      if (listeners[event]) {
        listeners[event].forEach((cb) => cb(data));
      }
    },
    _listeners: listeners,
  };
}

// ============================================================
// STREAM CALLBACKS MOCK
// ============================================================

/**
 * Creates mock streaming callbacks for chat tests.
 */
export function createMockStreamCallbacks() {
  return {
    onChunk: jest.fn(),
    onSessionId: jest.fn(),
    onStatus: jest.fn(),
    onComplete: jest.fn(),
  };
}

// ============================================================
// CHAT DATA FACTORIES
// ============================================================

/**
 * Creates a mock RecipeCard.
 */
export function createMockRecipeCard(overrides?: Partial<RecipeCard>): RecipeCard {
  return {
    recipeId: `recipe-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Recipe',
    imageUrl: 'https://example.com/recipe.jpg',
    totalTime: 30,
    difficulty: 'easy',
    portions: 4,
    ...overrides,
  };
}

/**
 * Creates a list of mock RecipeCards.
 */
export function createMockRecipeCardList(count: number): RecipeCard[] {
  return Array.from({ length: count }, (_, i) =>
    createMockRecipeCard({
      recipeId: `recipe-${i + 1}`,
      name: `Test Recipe ${i + 1}`,
    })
  );
}

/**
 * Creates a mock IrmixyResponse.
 */
export function createMockIrmixyResponse(overrides?: Partial<IrmixyResponse>): IrmixyResponse {
  return {
    version: '1.0',
    message: 'Hello! How can I help you today?',
    language: 'en',
    ...overrides,
  };
}

/**
 * Creates a mock IrmixyResponse with recipes.
 */
export function createMockIrmixyResponseWithRecipes(recipeCount = 2): IrmixyResponse {
  return createMockIrmixyResponse({
    message: 'Here are some recipes for you!',
    recipes: createMockRecipeCardList(recipeCount),
  });
}

// ============================================================
// CHAT MESSAGE FACTORIES
// ============================================================

/**
 * Creates a mock chat message from the database.
 */
export function createMockChatMessage(overrides?: {
  id?: string;
  role?: 'user' | 'assistant';
  content?: string;
  created_at?: string;
  tool_calls?: {
    recipes?: RecipeCard[];
    customRecipe?: GeneratedRecipe;
    safetyFlags?: SafetyFlags;
  };
}) {
  return {
    id: overrides?.id || `msg-${Math.random().toString(36).substr(2, 9)}`,
    role: overrides?.role || 'user',
    content: overrides?.content || 'Test message',
    created_at: overrides?.created_at || new Date().toISOString(),
    tool_calls: overrides?.tool_calls || null,
  };
}

/**
 * Creates a mock chat session from the database.
 */
export function createMockChatSession(overrides?: {
  id?: string;
  title?: string;
  created_at?: string;
}) {
  return {
    id: overrides?.id || `session-${Math.random().toString(36).substr(2, 9)}`,
    title: overrides?.title || 'Test Chat',
    created_at: overrides?.created_at || new Date().toISOString(),
  };
}

// ============================================================
// GENERATED RECIPE FACTORIES
// ============================================================

/**
 * Creates a mock GeneratedIngredient.
 */
export function createMockGeneratedIngredient(
  overrides?: Partial<GeneratedIngredient>
): GeneratedIngredient {
  return {
    name: 'chicken breast',
    quantity: 2,
    unit: 'lb',
    ...overrides,
  };
}

/**
 * Creates a list of mock GeneratedIngredients.
 */
export function createMockGeneratedIngredientList(count: number): GeneratedIngredient[] {
  const ingredients = [
    { name: 'chicken breast', quantity: 2, unit: 'lb' },
    { name: 'broccoli', quantity: 1, unit: 'cup' },
    { name: 'soy sauce', quantity: 2, unit: 'tbsp' },
    { name: 'garlic', quantity: 3, unit: 'cloves' },
    { name: 'ginger', quantity: 1, unit: 'tbsp' },
    { name: 'olive oil', quantity: 2, unit: 'tbsp' },
    { name: 'salt', quantity: 1, unit: 'tsp' },
    { name: 'pepper', quantity: 0.5, unit: 'tsp' },
    { name: 'sesame oil', quantity: 1, unit: 'tbsp' },
    { name: 'rice vinegar', quantity: 1, unit: 'tbsp' },
    { name: 'green onions', quantity: 2, unit: 'stalks' },
    { name: 'bell pepper', quantity: 1, unit: 'medium' },
  ];
  return ingredients.slice(0, count);
}

/**
 * Creates a mock GeneratedStep.
 */
export function createMockGeneratedStep(overrides?: Partial<GeneratedStep>): GeneratedStep {
  return {
    order: 1,
    instruction: 'Prepare the ingredients',
    ...overrides,
  };
}

/**
 * Creates a mock GeneratedRecipe.
 */
export function createMockGeneratedRecipe(overrides?: Partial<GeneratedRecipe>): GeneratedRecipe {
  return {
    schemaVersion: '1.0',
    suggestedName: 'Chicken Stir Fry',
    measurementSystem: 'imperial',
    language: 'en',
    ingredients: [
      { name: 'chicken breast', quantity: 2, unit: 'lb' },
      { name: 'broccoli', quantity: 1, unit: 'cup' },
      { name: 'soy sauce', quantity: 2, unit: 'tbsp' },
      { name: 'garlic', quantity: 3, unit: 'cloves' },
      { name: 'ginger', quantity: 1, unit: 'tbsp' },
    ],
    steps: [
      { order: 1, instruction: 'Cut chicken into cubes' },
      { order: 2, instruction: 'Stir fry vegetables' },
      { order: 3, instruction: 'Add sauce and serve' },
    ],
    totalTime: 30,
    difficulty: 'easy',
    portions: 4,
    tags: ['asian', 'quick', 'healthy'],
    ...overrides,
  };
}

/**
 * Creates a mock GeneratedRecipe with many ingredients (for testing truncation).
 */
export function createMockGeneratedRecipeWithManyIngredients(
  ingredientCount = 8
): GeneratedRecipe {
  return createMockGeneratedRecipe({
    ingredients: createMockGeneratedIngredientList(ingredientCount),
  });
}

/**
 * Creates a mock SafetyFlags object.
 */
export function createMockSafetyFlags(overrides?: Partial<SafetyFlags>): SafetyFlags {
  return {
    allergenWarning: undefined,
    dietaryConflict: undefined,
    error: undefined,
    ...overrides,
  };
}

/**
 * Creates a mock SafetyFlags with allergen warning.
 */
export function createMockSafetyFlagsWithWarning(warning: string): SafetyFlags {
  return createMockSafetyFlags({
    allergenWarning: warning,
    error: false,
  });
}

/**
 * Creates a mock SafetyFlags with error.
 */
export function createMockSafetyFlagsWithError(
  allergenWarning?: string,
  dietaryConflict?: string
): SafetyFlags {
  return createMockSafetyFlags({
    allergenWarning,
    dietaryConflict,
    error: true,
  });
}

// ============================================================
// USER RECIPE FACTORIES
// ============================================================

/**
 * Creates a mock UserRecipeSummary.
 */
export function createMockUserRecipeSummary(
  overrides?: Partial<UserRecipeSummary>
): UserRecipeSummary {
  return {
    id: `user-recipe-${Math.random().toString(36).substr(2, 9)}`,
    name: 'My Custom Recipe',
    source: 'ai_generated',
    createdAt: new Date().toISOString(),
    totalTime: 30,
    difficulty: 'easy',
    ...overrides,
  };
}

/**
 * Creates a list of mock UserRecipeSummary.
 */
export function createMockUserRecipeSummaryList(count: number): UserRecipeSummary[] {
  return Array.from({ length: count }, (_, i) =>
    createMockUserRecipeSummary({
      id: `user-recipe-${i + 1}`,
      name: `Custom Recipe ${i + 1}`,
      createdAt: new Date(Date.now() - i * 86400000).toISOString(), // Each day older
    })
  );
}
