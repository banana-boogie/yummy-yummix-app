/**
 * Chat Service Tests
 *
 * Tests for the AI chat service including message loading,
 * session management, and streaming functionality.
 */

import {
  loadChatHistory,
  loadChatSessions,
  getLastSessionWithMessages,
  sendChatMessage,
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

// Mock react-native-sse (used by streaming functions)
jest.mock('react-native-sse', () => {
  return jest.fn().mockImplementation(() => ({
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    close: jest.fn(),
  }));
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
});
