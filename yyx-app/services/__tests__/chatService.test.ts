/**
 * Chat Service Tests
 *
 * Tests for the AI chat service including message loading,
 * session management, and streaming functionality.
 *
 * SSE Event Lifecycle:
 * 1. session - Session ID assignment
 * 2. status - Processing status updates (thinking, generating, etc.)
 * 3. content - Token-by-token text streaming
 * 4. stream_complete - Text finished, input can be enabled
 * 5. done - Final response with recipes/customRecipe
 */

import {
  loadChatHistory,
  loadChatSessions,
  getLastSessionWithMessages,
  getRecentlyCookedRecipes,
  saveVoiceTranscript,
  createSimpleStreamCallbacks,
  routeSSEMessage,
  BudgetExceededError,
  parseBudgetExceededErrorFromSSEEvent,
} from '../chatService';
import { supabase } from '@/lib/supabase';
import {
  createMockChatMessage,
  createMockChatSession,
  createMockRecipeCardList,
} from '@/test/mocks/chat';

// Mock i18n
jest.mock('@/i18n', () => ({
  t: (key: string, params?: Record<string, any>) => {
    if (key === 'chat.error.messageTooLong') {
      return `Message too long (max ${params?.max} characters)`;
    }
    if (key === 'chat.newChatTitle') {
      return 'New Chat';
    }
    return key;
  },
}));

// Mock EventSource for SSE tests
let mockEventSourceInstance: any = null;
let mockEventListeners: Record<string, ((event: any) => void)[]> = {};

class MockEventSource {
  constructor() {
    mockEventSourceInstance = this;
    mockEventListeners = {};
  }
  addEventListener(event: string, handler: (event: any) => void) {
    if (!mockEventListeners[event]) {
      mockEventListeners[event] = [];
    }
    mockEventListeners[event].push(handler);
  }
  removeEventListener() {}
  close() {}
}

// Helper to simulate SSE events
function simulateSSEEvent(type: string, data: any) {
  const listeners = mockEventListeners['message'] || [];
  listeners.forEach((listener) => {
    listener({ data: JSON.stringify(data) });
  });
}

jest.mock('react-native-sse', () => {
  return jest.fn().mockImplementation(() => new MockEventSource());
});

describe('chatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
  });

  // ============================================================
  // loadChatHistory
  // ============================================================

  describe('loadChatHistory', () => {
    it('returns messages with recipes from tool_calls', async () => {
      const recipes = createMockRecipeCardList(2);
      const safetyFlags = { allergenWarning: 'Contains nuts' };
      const mockMessages = [
        createMockChatMessage({ role: 'user', content: 'Show me pasta recipes' }),
        createMockChatMessage({
          role: 'assistant',
          content: 'Here are some pasta recipes!',
          tool_calls: { recipes, safetyFlags },
        }),
      ];

      const mockSessionChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: 'session-123' }, error: null }),
      };
      const mockMessagesChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockMessages, error: null }),
      };
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'user_chat_sessions') return mockSessionChain;
        return mockMessagesChain;
      });

      const result = await loadChatHistory('session-123');

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[0].recipes).toBeUndefined();
      expect(result[1].role).toBe('assistant');
      expect(result[1].recipes).toEqual(recipes);
      expect(result[1].safetyFlags).toEqual(safetyFlags);
    });

    it('handles empty session', async () => {
      const mockSessionChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: 'empty-session' }, error: null }),
      };
      const mockMessagesChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'user_chat_sessions') return mockSessionChain;
        return mockMessagesChain;
      });

      const result = await loadChatHistory('empty-session');

      expect(result).toEqual([]);
    });

    it('throws on database error', async () => {
      const mockSessionChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: 'session-123' }, error: null }),
      };
      const mockMessagesChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'user_chat_sessions') return mockSessionChain;
        return mockMessagesChain;
      });

      await expect(loadChatHistory('session-123')).rejects.toEqual({
        message: 'Database error',
      });
    });
  });

  // ============================================================
  // loadChatSessions
  // ============================================================

  describe('loadChatSessions', () => {
    it('returns recent sessions ordered by date', async () => {
      const mockSessions = [
        createMockChatSession({ title: 'Recent Chat', created_at: '2024-01-15T10:00:00Z' }),
        createMockChatSession({ title: 'Older Chat', created_at: '2024-01-14T10:00:00Z' }),
      ];

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockSessions, error: null }),
      };
      (supabase.from as jest.Mock).mockReturnValue(mockChain);

      const result = await loadChatSessions();

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Recent Chat');
      expect(result[1].title).toBe('Older Chat');
      expect(mockChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockChain.limit).toHaveBeenCalledWith(5);
    });

    it('uses default title for sessions without title', async () => {
      // Create session with null title (simulating missing title from DB)
      const mockSessions = [{
        id: 'session-123',
        title: null,
        created_at: new Date().toISOString(),
      }];

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockSessions, error: null }),
      };
      (supabase.from as jest.Mock).mockReturnValue(mockChain);

      const result = await loadChatSessions();

      expect(result[0].title).toBe('New Chat');
    });
  });

  // ============================================================
  // getLastSessionWithMessages
  // ============================================================

  describe('getLastSessionWithMessages', () => {
    it('returns session with message count', async () => {
      const mockSession = createMockChatSession({ id: 'session-abc' });
      const mockMessage = createMockChatMessage({ created_at: '2024-01-15T12:00:00Z' });

      let userChatMessagesCallCount = 0;
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'user_chat_sessions') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({ data: [mockSession], error: null }),
          };
        }
        if (table === 'user_chat_messages') {
          userChatMessagesCallCount++;
          if (userChatMessagesCallCount === 1) {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue({
                data: [mockMessage],
                error: null,
              }),
            };
          }

          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                count: 5,
                error: null,
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const result = await getLastSessionWithMessages();

      expect(result).not.toBeNull();
      expect(result?.sessionId).toBe('session-abc');
      expect(result?.title).toBe(mockSession.title);
    });

    it('returns null if no sessions exist', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const result = await getLastSessionWithMessages();

      expect(result).toBeNull();
    });

    it('returns null if last session has no messages', async () => {
      const mockSession = createMockChatSession({ id: 'empty-session' });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'user_chat_sessions') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({ data: [mockSession], error: null }),
          };
        }
        // Messages table returns empty
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const result = await getLastSessionWithMessages();

      expect(result).toBeNull();
    });
  });

  // ============================================================
  // getRecentlyCookedRecipes
  // ============================================================

  describe('getRecentlyCookedRecipes', () => {
    it('returns mapped cook_complete events', async () => {
      const mockEvents = [
        {
          payload: { recipe_id: 'recipe-1', recipe_name: 'Pasta' },
          created_at: '2026-02-17T10:00:00Z',
        },
        {
          payload: { recipe_id: 'recipe-2', recipe_name: 'Soup' },
          created_at: '2026-02-16T10:00:00Z',
        },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockEvents, error: null }),
      });

      const result = await getRecentlyCookedRecipes(2);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        recipeId: 'recipe-1',
        recipeName: 'Pasta',
        cookedAt: new Date('2026-02-17T10:00:00Z'),
      });
      expect(result[1]).toEqual({
        recipeId: 'recipe-2',
        recipeName: 'Soup',
        cookedAt: new Date('2026-02-16T10:00:00Z'),
      });
    });

    it('returns empty array when user is not authenticated', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await getRecentlyCookedRecipes();
      expect(result).toEqual([]);
    });
  });

  // ============================================================
  // saveVoiceTranscript
  // ============================================================

  describe('saveVoiceTranscript', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('saves transcript and returns sessionId on success', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      });
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ sessionId: 'saved-session-123' }),
      });

      const messages = [
        { id: '1', role: 'user' as const, content: 'Hello', createdAt: new Date() },
        { id: '2', role: 'assistant' as const, content: 'Hi there!', createdAt: new Date() },
      ];

      const result = await saveVoiceTranscript(messages);

      expect(result).toEqual({ sessionId: 'saved-session-123' });
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain('irmixy-voice-orchestrator');
      const body = JSON.parse(opts.body);
      expect(body.action).toBe('save_transcript');
      expect(body.messages).toHaveLength(2);
    });

    it('returns null on network error (silent fail)', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      });
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const messages = [
        { id: '1', role: 'user' as const, content: 'Hello', createdAt: new Date() },
      ];

      const result = await saveVoiceTranscript(messages);

      expect(result).toBeNull();
    });

    it('returns null for empty messages without calling fetch', async () => {
      global.fetch = jest.fn();

      const result = await saveVoiceTranscript([]);

      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns null when no auth session', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });
      global.fetch = jest.fn();

      const messages = [
        { id: '1', role: 'user' as const, content: 'Hello', createdAt: new Date() },
      ];

      const result = await saveVoiceTranscript(messages);

      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // SSE Event Routing (Unit Tests)
  // ============================================================
  // Note: Integration tests for sendMessage require the FUNCTIONS_BASE_URL
  // to be set at module load time, which is difficult to mock in Jest.
  // These tests verify the event routing logic at the handler level instead.

  describe('SSE event routing logic', () => {
    it('routes stream_complete to onStreamComplete callback', () => {
      const callbacks = {
        onChunk: jest.fn(),
        onStreamComplete: jest.fn(),
        onComplete: jest.fn(),
      };

      const result = routeSSEMessage({ type: 'stream_complete' }, callbacks);

      expect(callbacks.onStreamComplete).toHaveBeenCalledTimes(1);
      expect(callbacks.onComplete).not.toHaveBeenCalled();
      expect(result.action).toBe('continue');
    });

    it('routes done event to onComplete callback with response', () => {
      const callbacks = {
        onChunk: jest.fn(),
        onStreamComplete: jest.fn(),
        onComplete: jest.fn(),
      };

      const mockResponse = {
        version: '1.0',
        message: 'Test response',
      };

      const result = routeSSEMessage({
        type: 'done',
        response: mockResponse,
      }, callbacks);

      expect(callbacks.onComplete).toHaveBeenCalledTimes(1);
      expect(callbacks.onComplete).toHaveBeenCalledWith(mockResponse);
      expect(callbacks.onStreamComplete).not.toHaveBeenCalled();
      expect(result.action).toBe('resolve');
    });

    it('routes content to onChunk callback', () => {
      const callbacks = {
        onChunk: jest.fn(),
        onStreamComplete: jest.fn(),
        onComplete: jest.fn(),
      };

      routeSSEMessage({ type: 'content', content: 'Hello ' }, callbacks);
      routeSSEMessage({ type: 'content', content: 'world!' }, callbacks);

      expect(callbacks.onChunk).toHaveBeenCalledTimes(2);
      expect(callbacks.onChunk).toHaveBeenNthCalledWith(1, 'Hello ');
      expect(callbacks.onChunk).toHaveBeenNthCalledWith(2, 'world!');
    });

    it('handles typical event sequence correctly', () => {
      const callbacks = {
        onChunk: jest.fn(),
        onSessionId: jest.fn(),
        onStatus: jest.fn(),
        onStreamComplete: jest.fn(),
        onComplete: jest.fn(),
      };

      // Simulate typical SSE event sequence
      routeSSEMessage({ type: 'session', sessionId: 'sess-123' }, callbacks);
      routeSSEMessage({ type: 'status', status: 'thinking' }, callbacks);
      routeSSEMessage({ type: 'content', content: 'Hello ' }, callbacks);
      routeSSEMessage({ type: 'content', content: 'world!' }, callbacks);
      routeSSEMessage({ type: 'stream_complete' }, callbacks);
      const doneResult = routeSSEMessage({
        type: 'done',
        response: { message: 'Hello world!' }
      }, callbacks);

      // Verify each callback was called correctly
      expect(callbacks.onSessionId).toHaveBeenCalledWith('sess-123');
      expect(callbacks.onStatus).toHaveBeenCalledWith('thinking');
      expect(callbacks.onChunk).toHaveBeenCalledTimes(2);
      expect(callbacks.onStreamComplete).toHaveBeenCalledTimes(1);
      expect(callbacks.onComplete).toHaveBeenCalledTimes(1);
      expect(doneResult.action).toBe('resolve');
    });

    it('does not crash when optional callbacks are undefined', () => {
      const callbacks = {
        onChunk: jest.fn(),
        // Other callbacks intentionally undefined
      };

      // Should not throw
      expect(() => {
        routeSSEMessage({ type: 'session', sessionId: 'sess-123' }, callbacks);
        routeSSEMessage({ type: 'status', status: 'thinking' }, callbacks);
        routeSSEMessage({ type: 'stream_complete' }, callbacks);
        routeSSEMessage({ type: 'done', response: { message: 'test' } }, callbacks);
      }).not.toThrow();
    });

    it('returns reject action for error events', () => {
      const callbacks = { onChunk: jest.fn() };
      const result = routeSSEMessage({
        type: 'error',
        error: 'Server failed',
      }, callbacks);

      expect(result.action).toBe('reject');
      expect(result.error?.message).toBe('Server failed');
    });

    it('routes recipe_partial to onPartialRecipe callback', () => {
      const callbacks = {
        onChunk: jest.fn(),
        onPartialRecipe: jest.fn(),
        onComplete: jest.fn(),
      };

      const mockPartialRecipe = {
        schemaVersion: '1.0',
        suggestedName: 'Quick Pasta',
        measurementSystem: 'metric',
        language: 'en',
        ingredients: [{ name: 'pasta', quantity: 200, unit: 'g' }],
        steps: [{ order: 1, instruction: 'Boil water' }],
        totalTime: 20,
        difficulty: 'easy',
        portions: 2,
        tags: ['quick', 'pasta'],
      };

      const result = routeSSEMessage({
        type: 'recipe_partial',
        recipe: mockPartialRecipe,
      }, callbacks);

      expect(callbacks.onPartialRecipe).toHaveBeenCalledTimes(1);
      expect(callbacks.onPartialRecipe).toHaveBeenCalledWith(mockPartialRecipe);
      expect(callbacks.onComplete).not.toHaveBeenCalled();
      expect(result.action).toBe('continue');
    });

    it('returns resolve even when onComplete throws', () => {
      const callbacks = {
        onChunk: jest.fn(),
        onComplete: jest.fn(() => { throw new Error('callback error'); }),
      };

      const result = routeSSEMessage(
        { type: 'done', response: { message: 'test', version: '1.0' } },
        callbacks,
      );

      expect(result.action).toBe('resolve');
      expect(callbacks.onComplete).toHaveBeenCalled();
    });

    it('returns continue even when onChunk throws', () => {
      const callbacks = {
        onChunk: jest.fn(() => { throw new Error('render error'); }),
      };

      const result = routeSSEMessage(
        { type: 'content', content: 'hello' },
        callbacks,
      );

      expect(result.action).toBe('continue');
      expect(callbacks.onChunk).toHaveBeenCalled();
    });

    it('returns continue even when onSessionId throws', () => {
      const callbacks = {
        onChunk: jest.fn(),
        onSessionId: jest.fn(() => { throw new Error('state error'); }),
      };

      const result = routeSSEMessage(
        { type: 'session', sessionId: 'sess-123' },
        callbacks,
      );

      expect(result.action).toBe('continue');
      expect(callbacks.onSessionId).toHaveBeenCalled();
    });

    it('returns continue even when onStatus throws', () => {
      const callbacks = {
        onChunk: jest.fn(),
        onStatus: jest.fn(() => { throw new Error('status error'); }),
      };

      const result = routeSSEMessage(
        { type: 'status', status: 'thinking' },
        callbacks,
      );

      expect(result.action).toBe('continue');
      expect(callbacks.onStatus).toHaveBeenCalled();
    });

    it('returns continue even when onStreamComplete throws', () => {
      const callbacks = {
        onChunk: jest.fn(),
        onStreamComplete: jest.fn(() => { throw new Error('stream error'); }),
      };

      const result = routeSSEMessage(
        { type: 'stream_complete' },
        callbacks,
      );

      expect(result.action).toBe('continue');
      expect(callbacks.onStreamComplete).toHaveBeenCalled();
    });

    it('returns continue even when onPartialRecipe throws', () => {
      const callbacks = {
        onChunk: jest.fn(),
        onPartialRecipe: jest.fn(() => { throw new Error('recipe error'); }),
      };

      const result = routeSSEMessage(
        { type: 'recipe_partial', recipe: { suggestedName: 'Test' } },
        callbacks,
      );

      expect(result.action).toBe('continue');
      expect(callbacks.onPartialRecipe).toHaveBeenCalled();
    });

    it('routes budget_warning to onBudgetWarning callback', () => {
      const callbacks = {
        onChunk: jest.fn(),
        onBudgetWarning: jest.fn(),
      };

      const result = routeSSEMessage(
        { type: 'budget_warning', usedUsd: 0.08, budgetUsd: 0.10 },
        callbacks,
      );

      expect(callbacks.onBudgetWarning).toHaveBeenCalledTimes(1);
      expect(callbacks.onBudgetWarning).toHaveBeenCalledWith({
        usedUsd: 0.08,
        budgetUsd: 0.10,
      });
      expect(result.action).toBe('continue');
    });

    it('does not crash when onBudgetWarning is undefined', () => {
      const callbacks = { onChunk: jest.fn() };

      expect(() => {
        routeSSEMessage(
          { type: 'budget_warning', usedUsd: 0.08, budgetUsd: 0.10 },
          callbacks,
        );
      }).not.toThrow();
    });

    it('returns continue even when onBudgetWarning throws', () => {
      const callbacks = {
        onChunk: jest.fn(),
        onBudgetWarning: jest.fn(() => { throw new Error('warning error'); }),
      };

      const result = routeSSEMessage(
        { type: 'budget_warning', usedUsd: 0.08, budgetUsd: 0.10 },
        callbacks,
      );

      expect(result.action).toBe('continue');
      expect(callbacks.onBudgetWarning).toHaveBeenCalled();
    });

    it('simple wrapper callback mapping keeps onComplete in final slot', () => {
      const onChunk = jest.fn();
      const onSessionId = jest.fn();
      const onStatus = jest.fn();
      const onComplete = jest.fn();

      const callbacks = createSimpleStreamCallbacks(
        onChunk,
        onSessionId,
        onStatus,
        onComplete,
      );

      expect(callbacks.onChunk).toBe(onChunk);
      expect(callbacks.onSessionId).toBe(onSessionId);
      expect(callbacks.onStatus).toBe(onStatus);
      expect(callbacks.onComplete).toBe(onComplete);
      expect(callbacks.onStreamComplete).toBeUndefined();
    });
  });

  describe('parseBudgetExceededErrorFromSSEEvent', () => {
    it('parses budget_exceeded from xhrStatus + message JSON body', () => {
      const error = parseBudgetExceededErrorFromSSEEvent({
        xhrStatus: 429,
        message: JSON.stringify({
          error: 'budget_exceeded',
          tier: 'free',
          usedUsd: 0.10,
          budgetUsd: 0.10,
        }),
      });

      expect(error).toBeInstanceOf(BudgetExceededError);
      expect(error?.tier).toBe('free');
      expect(error?.usedUsd).toBe(0.10);
      expect(error?.budgetUsd).toBe(0.10);
    });
  });

  // ============================================================
  // BudgetExceededError
  // ============================================================

  describe('BudgetExceededError', () => {
    it('has correct name and message', () => {
      const error = new BudgetExceededError({ tier: 'free', usedUsd: 0.10, budgetUsd: 0.10 });
      expect(error.name).toBe('BudgetExceededError');
      expect(error.message).toBe('budget_exceeded');
    });

    it('stores tier and budget info', () => {
      const error = new BudgetExceededError({ tier: 'premium', usedUsd: 2.0, budgetUsd: 2.0 });
      expect(error.tier).toBe('premium');
      expect(error.usedUsd).toBe(2.0);
      expect(error.budgetUsd).toBe(2.0);
    });

    it('defaults to free tier when no data provided', () => {
      const error = new BudgetExceededError({});
      expect(error.tier).toBe('free');
      expect(error.usedUsd).toBe(0);
      expect(error.budgetUsd).toBe(0);
    });

    it('is instanceof Error', () => {
      const error = new BudgetExceededError({});
      expect(error).toBeInstanceOf(Error);
    });
  });
});
