/**
 * Chat Mock Utilities
 *
 * Provides helper functions for mocking chat-related functionality in tests.
 *
 * FOR AI AGENTS:
 * - Use these helpers to mock SSE streaming and chat callbacks
 * - Always reset mocks between tests using jest.clearAllMocks()
 */

import type { IrmixyResponse, IrmixyStatus, RecipeCard, SuggestionChip } from '@/types/irmixy';

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
 * Creates a mock SuggestionChip.
 */
export function createMockSuggestionChip(overrides?: Partial<SuggestionChip>): SuggestionChip {
  return {
    label: 'Try this',
    message: 'What about this suggestion?',
    ...overrides,
  };
}

/**
 * Creates a list of mock SuggestionChips.
 */
export function createMockSuggestionChipList(count: number): SuggestionChip[] {
  return Array.from({ length: count }, (_, i) =>
    createMockSuggestionChip({
      label: `Suggestion ${i + 1}`,
      message: `Try suggestion ${i + 1}`,
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

/**
 * Creates a mock IrmixyResponse with suggestions.
 */
export function createMockIrmixyResponseWithSuggestions(suggestionCount = 3): IrmixyResponse {
  return createMockIrmixyResponse({
    suggestions: createMockSuggestionChipList(suggestionCount),
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
  tool_calls?: { recipes?: RecipeCard[] };
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
