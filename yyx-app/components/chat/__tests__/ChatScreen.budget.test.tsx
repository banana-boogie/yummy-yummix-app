/**
 * ChatScreen Budget UI Tests
 *
 * Tests budget warning/exceeded alerts and input disabling behavior.
 * Uses the same mock pattern as ChatScreen.test.tsx.
 */

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react-native';

import { ChatScreen } from '../ChatScreen';

// Mock i18n
jest.mock('@/i18n', () => ({
  t: (key: string, _params?: Record<string, unknown>) => {
    if (key === 'chat.greetingCycling.withName') {
      return ['Hi {{name}}, what are we cooking today?'];
    }
    if (key === 'chat.greetingCycling.withoutName') {
      return ['Hi, what are we cooking today?'];
    }
    const translations: Record<string, string> = {
      'chat.greeting': "Hi! I'm Irmixy, your AI sous chef. How can I help?",
      'chat.inputPlaceholder': 'Ask Irmixy...',
      'chat.budget.warningTitle': 'Heads up!',
      'chat.budget.warningDetailed': "You've been cooking up a storm!",
      'chat.budget.warmWarning': "Just a heads up — you've used most of your Irmixy time for this month.",
      'chat.budget.exceededTitle': 'Irmixy limit reached',
      'chat.budget.exceededMessage': "You've reached your monthly Irmixy limit.",
      'chat.budget.upgradeHint': 'Irmixy limit reached — resets next month',
      'chat.title': 'Irmixy',
      'chat.newChatTitle': 'New Chat',
      'chat.error.default': 'Something went wrong. Please try again.',
      'chat.stopGenerating': 'Stop generating',
      'chat.voice.listening': 'Listening...',
      'chat.voice.tapToSpeak': 'Tap to speak',
      'common.ok': 'OK',
    };
    return translations[key] || key;
  },
}));

// Mock contexts
const mockUser = { id: 'user-123', email: 'test@example.com' };
let mockAuthUser: typeof mockUser | null = mockUser;

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockAuthUser }),
}));

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en' }),
}));

jest.mock('@/contexts/UserProfileContext', () => ({
  useUserProfile: () => ({ userProfile: { name: 'TestUser' }, loading: false, error: null }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock chatService — capture onBudgetWarning callback from sendMessage calls
let capturedOnBudgetWarning: ((warning: { usedUsd: number; budgetUsd: number }) => void) | undefined;
const mockSendMessage = jest.fn().mockImplementation(
  (_msg: string, _sess: string | null, _onChunk: any, _onSessionId: any, _onStatus: any, _onStreamComplete: any, _onPartialRecipe: any, _onComplete: any, _options: any, onBudgetWarning: any) => {
    capturedOnBudgetWarning = onBudgetWarning;
    return {
      done: Promise.resolve(),
      cancel: jest.fn(),
    };
  },
);
const mockLoadChatHistory = jest.fn().mockResolvedValue([]);
const mockGetLastSessionWithMessages = jest.fn().mockResolvedValue(null);

jest.mock('@/services/chatService', () => {
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

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn().mockResolvedValue(undefined) }),
}));

jest.mock('@ronradtke/react-native-markdown-display', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: string }) => <Text>{children}</Text>,
  };
});

jest.mock('@/components/chat/IrmixyAvatar', () => ({
  IrmixyAvatar: () => {
    const { View } = require('react-native');
    return <View testID="irmixy-avatar" />;
  },
}));

jest.mock('@/components/chat/ChatRecipeCard', () => ({
  ChatRecipeCard: () => {
    const { View } = require('react-native');
    return <View testID="chat-recipe-card" />;
  },
}));

describe('ChatScreen budget UI', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockAuthUser = mockUser;
    mockLoadChatHistory.mockResolvedValue([]);
    mockGetLastSessionWithMessages.mockResolvedValue(null);
    capturedOnBudgetWarning = undefined;
    // Re-set default sendMessage implementation after clearAllMocks
    mockSendMessage.mockImplementation(
      (_msg: string, _sess: string | null, _onChunk: any, _onSessionId: any, _onStatus: any, _onStreamComplete: any, _onPartialRecipe: any, _onComplete: any, _options: any, onBudgetWarning: any) => {
        capturedOnBudgetWarning = onBudgetWarning;
        return { done: Promise.resolve(), cancel: jest.fn() };
      },
    );
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  // Helper: type and send a message to trigger sendMessage mock
  async function sendAMessage() {
    const input = screen.getByPlaceholderText('Ask Irmixy...');
    fireEvent.changeText(input, 'Hello');
    const sendButton = screen.getByTestId('send-button');
    fireEvent.press(sendButton);

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalled();
    });
  }

  it('injects warm Irmixy chat message on budget warning instead of Alert', async () => {
    render(<ChatScreen />);
    await sendAMessage();

    // Invoke the captured onBudgetWarning callback
    expect(capturedOnBudgetWarning).toBeDefined();
    act(() => {
      capturedOnBudgetWarning!({ usedUsd: 0.085, budgetUsd: 0.10 });
    });

    // Should NOT show a system Alert
    expect(alertSpy).not.toHaveBeenCalledWith(
      'Heads up!',
      expect.anything(),
    );

    // Should inject a warm Irmixy message into the chat
    await waitFor(() => {
      expect(screen.getByText("Just a heads up — you've used most of your Irmixy time for this month.")).toBeTruthy();
    });
  });

  it('shows exceeded alert and disables input when budget is exceeded', async () => {
    // Make sendMessage reject with BudgetExceededError
    const { BudgetExceededError } = jest.requireMock('@/services/chatService');
    mockSendMessage.mockImplementationOnce(() => ({
      done: Promise.reject(new BudgetExceededError({ tier: 'free', usedUsd: 0.10, budgetUsd: 0.10 })),
      cancel: jest.fn(),
    }));

    render(<ChatScreen />);
    await sendAMessage();

    // Wait for the error to propagate and Alert to be called
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Irmixy limit reached',
        "You've reached your monthly Irmixy limit.",
      );
    });

    // Input should show the upgrade hint as placeholder
    await waitFor(() => {
      const input = screen.getByPlaceholderText('Irmixy limit reached — resets next month');
      expect(input.props.editable).toBe(false);
    });
  });

  it('resets budget exceeded state on session change', async () => {
    // First, trigger budget exceeded
    const { BudgetExceededError } = jest.requireMock('@/services/chatService');
    mockSendMessage.mockImplementationOnce(() => ({
      done: Promise.reject(new BudgetExceededError({ tier: 'free', usedUsd: 0.10, budgetUsd: 0.10 })),
      cancel: jest.fn(),
    }));

    const { rerender } = render(<ChatScreen sessionId="session-1" />);
    await sendAMessage();

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });

    // Verify input is disabled
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Irmixy limit reached — resets next month')).toBeTruthy();
    });

    // Switch session — should reset budget exceeded
    rerender(<ChatScreen sessionId="session-2" />);

    await waitFor(() => {
      const input = screen.getByPlaceholderText('Ask Irmixy...');
      expect(input.props.editable).not.toBe(false);
    });
  });

  it('resets budget exceeded state on new chat signal', async () => {
    // First, trigger budget exceeded
    const { BudgetExceededError } = jest.requireMock('@/services/chatService');
    mockSendMessage.mockImplementationOnce(() => ({
      done: Promise.reject(new BudgetExceededError({ tier: 'free', usedUsd: 0.10, budgetUsd: 0.10 })),
      cancel: jest.fn(),
    }));

    const { rerender } = render(<ChatScreen newChatSignal={1} />);
    await sendAMessage();

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });

    // Verify input is disabled
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Irmixy limit reached — resets next month')).toBeTruthy();
    });

    // Trigger new chat signal — should reset budget exceeded
    rerender(<ChatScreen newChatSignal={2} />);

    await waitFor(() => {
      const input = screen.getByPlaceholderText('Ask Irmixy...');
      expect(input.props.editable).not.toBe(false);
    });
  });
});
