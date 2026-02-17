/**
 * ChatScreen Component Tests
 *
 * Tests for the main chat interface component.
 * Note: Due to FlatList/VirtualizedList complexity in jest-expo,
 * these tests focus on component behavior rather than full render trees.
 */

import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';

// Mock all dependencies before importing ChatScreen
jest.mock('@/i18n', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      'chat.greeting': 'Hi! I\'m Irmixy, your AI sous chef. How can I help?',
      'chat.loginRequired': 'Please log in to use the chat.',
      'chat.inputPlaceholder': 'Ask Irmixy...',
      'chat.thinking': 'Thinking',
      'chat.searching': 'Searching recipes',
      'chat.generating': 'Creating response',
      'chat.error.default': 'Something went wrong. Please try again.',
      'chat.title': 'Irmixy',
      'chat.suggestions.suggestRecipe': 'Suggest a recipe',
      'chat.suggestions.whatCanICook': 'What can I cook?',
      'chat.suggestions.quickMeal': 'Quick meal ideas',
      'chat.suggestions.ingredientsIHave': 'Ingredients I have',
      'chat.suggestions.healthyOptions': 'Healthy options',
      'chat.suggestions.createCustomRecipeLabel': 'Create a custom recipe',
      'chat.suggestions.createCustomRecipeMessage': 'Create a custom recipe for me',
      'common.copied': 'Copied',
      'common.ok': 'OK',
      'common.cancel': 'Cancel',
      'chat.messageCopied': 'Message copied to clipboard',
      'chat.error.title': 'Error',
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

jest.mock('@/services/chatService', () => ({
  loadChatHistory: (...args: any[]) => mockLoadChatHistory(...args),
  sendMessage: (...args: any[]) => mockSendMessage(...args),
}));

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

// Mock SuggestionChips
jest.mock('@/components/chat/SuggestionChips', () => ({
  SuggestionChips: ({ suggestions, onSelect, disabled }: any) => {
    const { View, Text, TouchableOpacity } = require('react-native');
    if (!suggestions || suggestions.length === 0) return null;
    return (
      <View testID="suggestion-chips">
        {suggestions.map((s: any, i: number) => (
          <TouchableOpacity key={i} onPress={() => onSelect(s)} disabled={disabled}>
            <Text>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  },
}));

import { ChatScreen } from '../ChatScreen';
import { createMockRecipeCardList } from '@/test/mocks/chat';

describe('ChatScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser = mockUser;
    mockLoadChatHistory.mockResolvedValue([]);
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
    it('renders suggestion chips when chat is empty', () => {
      render(<ChatScreen />);

      expect(screen.getByTestId('suggestion-chips')).toBeTruthy();
      expect(screen.getByText('Suggest a recipe')).toBeTruthy();
    });

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

      fireEvent.press(screen.getByText('Suggest a recipe'));

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
  // SUGGESTION HANDLING TESTS
  // ============================================================

  describe('suggestion handling', () => {
    it('hides initial suggestions when messages exist', () => {
      const messages = [
        {
          id: 'msg-1',
          role: 'user' as const,
          content: 'Hello',
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant' as const,
          content: 'Hi!',
          createdAt: new Date(),
        },
      ];

      render(<ChatScreen messages={messages} />);

      // Suggestions should not be shown with messages (unless dynamic)
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

});
