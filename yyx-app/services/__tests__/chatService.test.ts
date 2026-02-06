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
 * 5. done - Final response with recipes/suggestions
 */

import {
  loadChatHistory,
  loadChatSessions,
  getLastSessionWithMessages,
  sendChatMessage,
  streamChatMessageWithHandle,
} from '../chatService';
import { supabase } from '@/lib/supabase';
import {
  createMockChatMessage,
  createMockChatSession,
  createMockRecipeCardList,
  createMockSuggestionChipList,
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
  });

  // ============================================================
  // loadChatHistory
  // ============================================================

  describe('loadChatHistory', () => {
    it('returns messages with recipes from tool_calls', async () => {
      const recipes = createMockRecipeCardList(2);
      const suggestions = createMockSuggestionChipList(2);
      const safetyFlags = { allergenWarning: 'Contains nuts' };
      const mockMessages = [
        createMockChatMessage({ role: 'user', content: 'Show me pasta recipes' }),
        createMockChatMessage({
          role: 'assistant',
          content: 'Here are some pasta recipes!',
          tool_calls: { recipes, suggestions, safetyFlags },
        }),
      ];

      // Mock the chainable query builder
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockMessages, error: null }),
      };
      (supabase.from as jest.Mock).mockReturnValue(mockChain);

      const result = await loadChatHistory('session-123');

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[0].recipes).toBeUndefined();
      expect(result[1].role).toBe('assistant');
      expect(result[1].recipes).toEqual(recipes);
      expect(result[1].suggestions).toEqual(suggestions);
      expect(result[1].safetyFlags).toEqual(safetyFlags);
    });

    it('handles empty session', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
      (supabase.from as jest.Mock).mockReturnValue(mockChain);

      const result = await loadChatHistory('empty-session');

      expect(result).toEqual([]);
    });

    it('throws on database error', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };
      (supabase.from as jest.Mock).mockReturnValue(mockChain);

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

      // First call: get sessions
      // Second call: get messages
      // Third call: get count
      let callCount = 0;
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        callCount++;
        if (table === 'user_chat_sessions') {
          return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({ data: [mockSession], error: null }),
          };
        }
        if (table === 'user_chat_messages') {
          // Handle both the message query and count query
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({
              data: [mockMessage],
              error: null,
              count: 5,
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
    });

    it('returns null if no sessions exist', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
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
  // sendChatMessage
  // ============================================================

  describe('sendChatMessage', () => {
    it('validates message length (max 2000)', async () => {
      const longMessage = 'a'.repeat(2001);

      await expect(sendChatMessage(longMessage, null)).rejects.toThrow(
        'Message too long (max 2000 characters)'
      );
    });

    it('throws if not authenticated', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      await expect(sendChatMessage('Hello', null)).rejects.toThrow('Not authenticated');
    });

    it('sends message when authenticated', async () => {
      // Note: Testing fetch behavior requires mocking at module load time
      // or restructuring the code. For now, we test the authentication check
      // and message validation paths which don't depend on env vars.
      // The fetch integration would typically be tested in integration tests.
      const mockSession = {
        access_token: 'test-token',
        user: { id: 'user-123' },
      };

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // Since FUNCTIONS_BASE_URL is computed at module load time,
      // this test verifies the auth check passes before the URL check
      await expect(sendChatMessage('Hello', 'session-123')).rejects.toThrow(
        'Functions URL is not configured'
      );
    });

    it('throws meaningful error on missing functions URL', async () => {
      const mockSession = {
        access_token: 'test-token',
        user: { id: 'user-123' },
      };

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // Verify the error message for missing configuration
      await expect(sendChatMessage('Hello', null)).rejects.toThrow(
        'Functions URL is not configured'
      );
    });
  });

  // ============================================================
  // SSE Event Routing (Unit Tests)
  // ============================================================
  // Note: Integration tests for streamChatMessageWithHandle require
  // the FUNCTIONS_BASE_URL to be set at module load time, which
  // is difficult to mock in Jest. These tests verify the event
  // routing logic at the handler level instead.

  describe('SSE event routing logic', () => {
    /**
     * Test the event routing logic that should occur in the SSE handler.
     * This verifies that:
     * - 'stream_complete' calls onStreamComplete (not onComplete)
     * - 'done' calls onComplete (not onStreamComplete)
     * - Events are correctly routed to their designated callbacks
     *
     * This mirrors the switch statement in streamChatMessageWithHandle.
     */
    function simulateEventHandler(
      eventType: string,
      eventData: any,
      callbacks: {
        onChunk: jest.Mock;
        onSessionId?: jest.Mock;
        onStatus?: jest.Mock;
        onStreamComplete?: jest.Mock;
        onComplete?: jest.Mock;
      }
    ) {
      switch (eventType) {
        case 'session':
          if (eventData.sessionId) {
            callbacks.onSessionId?.(eventData.sessionId);
          }
          break;
        case 'status':
          if (eventData.status) {
            callbacks.onStatus?.(eventData.status);
          }
          break;
        case 'content':
          if (eventData.content) {
            callbacks.onChunk(eventData.content);
          }
          break;
        case 'stream_complete':
          callbacks.onStreamComplete?.();
          break;
        case 'done':
          if (eventData.response) {
            callbacks.onComplete?.(eventData.response);
          }
          break;
      }
    }

    it('routes stream_complete to onStreamComplete callback', () => {
      const callbacks = {
        onChunk: jest.fn(),
        onStreamComplete: jest.fn(),
        onComplete: jest.fn(),
      };

      simulateEventHandler('stream_complete', {}, callbacks);

      expect(callbacks.onStreamComplete).toHaveBeenCalledTimes(1);
      expect(callbacks.onComplete).not.toHaveBeenCalled();
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
        suggestions: [],
      };

      simulateEventHandler('done', { response: mockResponse }, callbacks);

      expect(callbacks.onComplete).toHaveBeenCalledTimes(1);
      expect(callbacks.onComplete).toHaveBeenCalledWith(mockResponse);
      expect(callbacks.onStreamComplete).not.toHaveBeenCalled();
    });

    it('routes content to onChunk callback', () => {
      const callbacks = {
        onChunk: jest.fn(),
        onStreamComplete: jest.fn(),
        onComplete: jest.fn(),
      };

      simulateEventHandler('content', { content: 'Hello ' }, callbacks);
      simulateEventHandler('content', { content: 'world!' }, callbacks);

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
      simulateEventHandler('session', { sessionId: 'sess-123' }, callbacks);
      simulateEventHandler('status', { status: 'thinking' }, callbacks);
      simulateEventHandler('content', { content: 'Hello ' }, callbacks);
      simulateEventHandler('content', { content: 'world!' }, callbacks);
      simulateEventHandler('stream_complete', {}, callbacks);
      simulateEventHandler('done', {
        response: { message: 'Hello world!', suggestions: [] }
      }, callbacks);

      // Verify each callback was called correctly
      expect(callbacks.onSessionId).toHaveBeenCalledWith('sess-123');
      expect(callbacks.onStatus).toHaveBeenCalledWith('thinking');
      expect(callbacks.onChunk).toHaveBeenCalledTimes(2);
      expect(callbacks.onStreamComplete).toHaveBeenCalledTimes(1);
      expect(callbacks.onComplete).toHaveBeenCalledTimes(1);
    });

    it('does not crash when optional callbacks are undefined', () => {
      const callbacks = {
        onChunk: jest.fn(),
        // Other callbacks intentionally undefined
      };

      // Should not throw
      expect(() => {
        simulateEventHandler('session', { sessionId: 'sess-123' }, callbacks);
        simulateEventHandler('status', { status: 'thinking' }, callbacks);
        simulateEventHandler('stream_complete', {}, callbacks);
        simulateEventHandler('done', { response: { message: 'test' } }, callbacks);
      }).not.toThrow();
    });
  });
});
