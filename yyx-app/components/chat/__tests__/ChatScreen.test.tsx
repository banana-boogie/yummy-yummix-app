/**
 * ChatScreen Component Tests
 *
 * Tests for the main chat interface component.
 * Note: Due to FlatList/VirtualizedList complexity in jest-expo,
 * these tests focus on component behavior rather than full render trees.
 */

import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ChatScreen } from '../ChatScreen';
import { createMockRecipeCardList } from '@/test/mocks/chat';

// Mock all dependencies before importing ChatScreen
jest.mock('@/i18n', () => ({
  t: (key: string, params?: Record<string, unknown>) => {
    if (key === 'chat.resume.chatAbout') {
      return `You were chatting about '${params?.title}'`;
    }

    const translations: Record<string, string> = {
      'chat.greeting': 'Hi! I\'m Irmixy, your AI sous chef. How can I help?',
      'chat.loginRequired': 'Please log in to use the chat.',
      'chat.inputPlaceholder': 'Ask Irmixy...',
      'chat.thinking': 'Thinking',
      'chat.searching': 'Searching recipes',
      'chat.generating': 'Creating response',
      'chat.error.default': 'Something went wrong. Please try again.',
      'chat.title': 'Irmixy',
      'chat.resume.previousConversations': 'Previous conversations',
      'chat.resume.continue': 'Continue',
      'common.copied': 'Copied',
      'common.ok': 'OK',
      'common.cancel': 'Cancel',
      'chat.messageCopied': 'Message copied to clipboard',
      'chat.error.title': 'Error',
      'chat.stopGenerating': 'Stop generating',
      'chat.voice.listening': 'Listening...',
      'chat.voice.tapToSpeak': 'Tap to speak',
      'chat.budget.warningTitle': 'Usage Warning',
      'chat.budget.warning': "You're approaching your monthly AI limit.",
      'chat.budget.warningDetailed': `You've used $${params?.usedUsd} of your $${params?.budgetUsd} monthly AI budget.`,
      'chat.budget.exceededTitle': 'Monthly Limit Reached',
      'chat.budget.exceededMessage': "You've used your monthly AI budget. Your budget resets at the start of next month.",
      'chat.budget.upgradeHint': 'Monthly AI limit reached',
    };
    return translations[key] || key;
  },
}));

// Mock contexts
const mockUser = { id: 'user-123', email: 'test@example.com' };
let mockAuthUser: typeof mockUser | null = mockUser;
const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: any[]) => mockRouterPush(...args),
  },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockAuthUser }),
}));

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en' }),
}));

// Mock safe area
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

// Mock expo-clipboard
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock chatService
const mockLoadChatHistory = jest.fn().mockResolvedValue([]);
const mockSendMessage = jest.fn().mockReturnValue({
  done: Promise.resolve(),
  cancel: jest.fn(),
});
const mockGetLastSessionWithMessages = jest.fn().mockResolvedValue(null);

jest.mock('@/services/chatService', () => {
  // Define inside factory so it's available when jest.mock is hoisted
  class BudgetExceededError extends Error {
    tier: string;
    usedUsd: number;
    budgetUsd: number;
    constructor(data: { tier?: string; usedUsd?: number; budgetUsd?: number } = {}) {
      super('budget_exceeded');
      this.name = 'BudgetExceededError';
      this.tier = data.tier || 'free';
      this.usedUsd = data.usedUsd || 0;
      this.budgetUsd = data.budgetUsd || 0;
    }
  }
  return {
    loadChatHistory: (...args: any[]) => mockLoadChatHistory(...args),
    sendMessage: (...args: any[]) => mockSendMessage(...args),
    getLastSessionWithMessages: (...args: any[]) => mockGetLastSessionWithMessages(...args),
    BudgetExceededError,
  };
});

const mockInvalidateQueries = jest.fn().mockResolvedValue(undefined);
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

// Mock markdown
jest.mock('react-native-markdown-display', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: string }) => <Text>{children}</Text>,
  };
});

// Mock IrmixyAvatar
jest.mock('@/components/chat/IrmixyAvatar', () => ({
  IrmixyAvatar: () => {
    const { View } = require('react-native');
    return <View testID="irmixy-avatar" />;
  },
}));

// Mock ChatRecipeCard
jest.mock('@/components/chat/ChatRecipeCard', () => ({
  ChatRecipeCard: ({ recipe }: { recipe: { name: string } }) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="chat-recipe-card">
        <Text>{recipe.name}</Text>
      </View>
    );
  },
}));

describe('ChatScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser = mockUser;
    mockLoadChatHistory.mockResolvedValue([]);
    mockGetLastSessionWithMessages.mockResolvedValue(null);
  });

  // ============================================================
  // AUTHENTICATION TESTS
  // ============================================================

  describe('authentication', () => {
    it('shows login required message when user is not authenticated', () => {
      mockAuthUser = null;

      render(<ChatScreen />);

      expect(screen.getByText('Please log in to use the chat.')).toBeTruthy();
    });

    it('renders chat interface when user is authenticated', () => {
      mockAuthUser = mockUser;

      render(<ChatScreen />);

      expect(screen.getByPlaceholderText('Ask Irmixy...')).toBeTruthy();
    });
  });

  // ============================================================
  // EMPTY STATE TESTS
  // ============================================================

  describe('empty state', () => {
    it('renders greeting in empty state', () => {
      render(<ChatScreen />);

      expect(screen.getByText("Hi! I'm Irmixy, your AI sous chef. How can I help?")).toBeTruthy();
    });
  });

  // ============================================================
  // INPUT HANDLING TESTS
  // ============================================================

  describe('input handling', () => {
    it('renders input field with placeholder', () => {
      render(<ChatScreen />);

      expect(screen.getByPlaceholderText('Ask Irmixy...')).toBeTruthy();
    });

    it('allows typing in input field', () => {
      render(<ChatScreen />);

      const input = screen.getByPlaceholderText('Ask Irmixy...');
      fireEvent.changeText(input, 'Hello Irmixy');

      expect(input.props.value).toBe('Hello Irmixy');
    });

    it('enforces max message length of 2000 characters', () => {
      render(<ChatScreen />);

      const input = screen.getByPlaceholderText('Ask Irmixy...');

      expect(input.props.maxLength).toBe(2000);
    });
  });

  // ============================================================
  // SESSION SWITCHING TESTS
  // ============================================================

  describe('session switching', () => {
    it('cancels active stream when sessionId changes', async () => {
      const mockCancel = jest.fn();
      mockSendMessage.mockReturnValueOnce({
        done: new Promise(() => {}),
        cancel: mockCancel,
      });

      const { rerender } = render(<ChatScreen sessionId="session-1" />);

      // Type a message and send
      const input = screen.getByPlaceholderText('Ask Irmixy...');
      fireEvent.changeText(input, 'Hello');
      // Find the send button by testID
      const sendButton = screen.getByTestId('send-button');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalled();
      });

      rerender(<ChatScreen sessionId="session-2" />);

      await waitFor(() => {
        expect(mockCancel).toHaveBeenCalled();
      });
    });
  });

  // ============================================================
  // MESSAGE RENDERING TESTS
  // ============================================================

  describe('message rendering', () => {
    it('renders user messages', () => {
      const messages = [
        {
          id: 'msg-1',
          role: 'user' as const,
          content: 'How do I make pasta?',
          createdAt: new Date(),
        },
      ];

      render(<ChatScreen messages={messages} />);

      expect(screen.getByText('How do I make pasta?')).toBeTruthy();
    });

    it('renders assistant messages', () => {
      const messages = [
        {
          id: 'msg-1',
          role: 'assistant' as const,
          content: 'Here is how to make pasta...',
          createdAt: new Date(),
        },
      ];

      render(<ChatScreen messages={messages} />);

      expect(screen.getByText('Here is how to make pasta...')).toBeTruthy();
    });

    it('renders recipe cards for assistant messages with recipes', () => {
      const recipes = createMockRecipeCardList(2);
      const messages = [
        {
          id: 'msg-1',
          role: 'assistant' as const,
          content: 'Here are some recipes:',
          createdAt: new Date(),
          recipes,
        },
      ];

      render(<ChatScreen messages={messages} />);

      expect(screen.getAllByTestId('chat-recipe-card')).toHaveLength(2);
    });
  });

  // ============================================================
  // NO SUGGESTION CHIPS
  // ============================================================

  describe('no suggestion chips', () => {
    it('does not render suggestion chips anywhere', () => {
      render(<ChatScreen />);

      expect(screen.queryByTestId('suggestion-chips')).toBeNull();
    });
  });

  // ============================================================
  // EXTERNAL MESSAGES (LIFTED STATE) TESTS
  // ============================================================

  describe('external messages (lifted state)', () => {
    it('uses external messages when provided', () => {
      const externalMessages = [
        {
          id: 'ext-1',
          role: 'user' as const,
          content: 'External message content',
          createdAt: new Date(),
        },
      ];

      render(<ChatScreen messages={externalMessages} />);

      expect(screen.getByText('External message content')).toBeTruthy();
    });
  });

  // ============================================================
  // RESUME BANNER TESTS
  // ============================================================

  describe('resume banner', () => {
    it('shows resume banner when a recent titled session exists', async () => {
      mockGetLastSessionWithMessages.mockResolvedValue({
        sessionId: 'session-1',
        title: 'Pasta Carbonara',
        messageCount: 3,
        lastMessageAt: new Date(),
      });

      render(<ChatScreen />);

      await waitFor(() => {
        expect(screen.getByText("You were chatting about 'Pasta Carbonara'")).toBeTruthy();
      });
    });

    it('continues a resumable session and loads history', async () => {
      const onSessionCreated = jest.fn();
      mockGetLastSessionWithMessages.mockResolvedValue({
        sessionId: 'session-1',
        title: 'Pasta Carbonara',
        messageCount: 3,
        lastMessageAt: new Date(),
      });
      mockLoadChatHistory.mockResolvedValueOnce([
        {
          id: 'restored-1',
          role: 'assistant',
          content: 'Restored message',
          createdAt: new Date(),
        },
      ]);

      render(<ChatScreen onSessionCreated={onSessionCreated} />);

      await waitFor(() => {
        expect(screen.getByText("You were chatting about 'Pasta Carbonara'")).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Continue'));

      await waitFor(() => {
        expect(mockLoadChatHistory).toHaveBeenCalledWith('session-1');
        expect(onSessionCreated).toHaveBeenCalledWith('session-1');
        expect(screen.getByText('Restored message')).toBeTruthy();
      });
    });

    it('dismisses resume banner when close is pressed', async () => {
      mockGetLastSessionWithMessages.mockResolvedValue({
        sessionId: 'session-1',
        title: 'Pasta Carbonara',
        messageCount: 3,
        lastMessageAt: new Date(),
      });

      render(<ChatScreen />);

      await waitFor(() => {
        expect(screen.getByText("You were chatting about 'Pasta Carbonara'")).toBeTruthy();
      });

      fireEvent.press(screen.getByLabelText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByText("You were chatting about 'Pasta Carbonara'")).toBeNull();
      });
    });

    it('hides resume banner when new chat signal changes', async () => {
      mockGetLastSessionWithMessages.mockResolvedValue({
        sessionId: 'session-1',
        title: 'Pasta Carbonara',
        messageCount: 3,
        lastMessageAt: new Date(),
      });

      const { rerender } = render(<ChatScreen newChatSignal={0} />);

      await waitFor(() => {
        expect(screen.getByText("You were chatting about 'Pasta Carbonara'")).toBeTruthy();
      });

      rerender(<ChatScreen newChatSignal={1} />);

      await waitFor(() => {
        expect(screen.queryByText("You were chatting about 'Pasta Carbonara'")).toBeNull();
      });
    });
  });

  // ============================================================
  // STOP BUTTON TESTS
  // ============================================================

  describe('stop button', () => {
    it('shows send button when not loading', () => {
      render(<ChatScreen />);

      // Input should be editable
      const input = screen.getByPlaceholderText('Ask Irmixy...');
      expect(input.props.editable).not.toBe(false);

      // Stop button should not exist
      expect(screen.queryByTestId('stop-button')).toBeNull();
      expect(screen.queryByLabelText('Stop generating')).toBeNull();
    });

    it('shows stop button when loading', async () => {
      const mockCancel = jest.fn();
      mockSendMessage.mockReturnValueOnce({
        done: new Promise(() => {}),
        cancel: mockCancel,
      });

      render(<ChatScreen />);

      // Type and send a message to trigger loading
      const input = screen.getByPlaceholderText('Ask Irmixy...');
      fireEvent.changeText(input, 'Make me a recipe');
      const sendButton = screen.getByTestId('send-button');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalled();
      });

      // Stop button should be visible
      await waitFor(() => {
        expect(screen.getByTestId('stop-button')).toBeTruthy();
        expect(screen.getByLabelText('Stop generating')).toBeTruthy();
      });
    });

    it('cancels stream when stop button is pressed', async () => {
      const mockCancel = jest.fn();
      mockSendMessage.mockReturnValueOnce({
        done: new Promise(() => {}),
        cancel: mockCancel,
      });

      render(<ChatScreen />);

      // Send a message
      const input = screen.getByPlaceholderText('Ask Irmixy...');
      fireEvent.changeText(input, 'Make me a recipe');
      fireEvent.press(screen.getByTestId('send-button'));

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalled();
      });

      // Wait for stop button to appear and press it
      await waitFor(() => {
        expect(screen.getByTestId('stop-button')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('stop-button'));

      // The cancel function from the stream handle should have been called
      expect(mockCancel).toHaveBeenCalled();
    });

    it('re-enables input after stop button is pressed', async () => {
      const mockCancel = jest.fn();
      mockSendMessage.mockReturnValueOnce({
        done: new Promise(() => {}),
        cancel: mockCancel,
      });

      render(<ChatScreen />);

      const input = screen.getByPlaceholderText('Ask Irmixy...');
      fireEvent.changeText(input, 'Make me a recipe');
      fireEvent.press(screen.getByTestId('send-button'));

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByTestId('stop-button')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('stop-button'));

      // Input should be re-enabled after stopping
      await waitFor(() => {
        const refreshedInput = screen.getByPlaceholderText('Ask Irmixy...');
        expect(refreshedInput.props.editable).not.toBe(false);
      });

      // Stop button should be gone, send button back
      expect(screen.queryByTestId('stop-button')).toBeNull();
    });
  });

  // ============================================================
  // BUDGET EXCEEDED TESTS
  // ============================================================

  describe('budget exceeded', () => {
    // Get the BudgetExceededError from the mocked module (must match instanceof check)
    const { BudgetExceededError } = jest.requireMock('@/services/chatService');

    it('disables input when budget is exceeded', async () => {
      // Simulate sendMessage rejecting with BudgetExceededError
      mockSendMessage.mockReturnValueOnce({
        done: Promise.reject(new BudgetExceededError({ tier: 'free', usedUsd: 0.10, budgetUsd: 0.10 })),
        cancel: jest.fn(),
      });

      render(<ChatScreen />);

      // Type and send a message to trigger budget exceeded
      const input = screen.getByPlaceholderText('Ask Irmixy...');
      fireEvent.changeText(input, 'Hello');
      fireEvent.press(screen.getByTestId('send-button'));

      // After budget exceeded, input should be disabled with hint text
      await waitFor(() => {
        const refreshedInput = screen.getByPlaceholderText('Monthly AI limit reached');
        expect(refreshedInput.props.editable).toBe(false);
      });
    });

    it('removes user and assistant messages when budget is exceeded', async () => {
      mockSendMessage.mockReturnValueOnce({
        done: Promise.reject(new BudgetExceededError()),
        cancel: jest.fn(),
      });

      render(<ChatScreen />);

      const input = screen.getByPlaceholderText('Ask Irmixy...');
      fireEvent.changeText(input, 'Hello');
      fireEvent.press(screen.getByTestId('send-button'));

      // After budget exceeded, the user message "Hello" should be removed
      await waitFor(() => {
        expect(screen.queryByText('Hello')).toBeNull();
      });
    });
  });
});
