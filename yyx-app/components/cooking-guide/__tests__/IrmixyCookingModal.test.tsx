/**
 * IrmixyCookingModal Component Tests
 *
 * Tests for the full-screen modal chat that opens from the cooking guide.
 * Covers rendering states, header content, close button, and input bar.
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { IrmixyCookingModal } from '../IrmixyCookingModal';

// Mock i18n
jest.mock('@/i18n', () => ({
  t: (key: string, params?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      'chat.title': 'Irmixy',
      'chat.cookingModal.greeting': 'How can I help with your recipe?',
      'chat.inputPlaceholder': 'Ask Irmixy...',
      'common.close': 'Close',
      'chat.stopGenerating': 'Stop generating',
      'chat.voice.tapToSpeak': 'Tap to speak',
      'chat.voice.listening': 'Listening...',
      'chat.voice.stopRecording': 'Stop recording',
      'chat.sendButton': 'Send',
      'chat.error.default': 'Something went wrong.',
    };
    if (key === 'chat.cookingModal.contextHint') {
      return `${params?.recipeName} - Step ${params?.step}/${params?.total}`;
    }
    return translations[key] || key;
  },
}));

// Mock contexts
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'en-US', language: 'en' }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'test@example.com' } }),
}));

// Mock safe area
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

// Mock chatService
jest.mock('@/services/chatService', () => ({
  sendMessage: jest.fn().mockReturnValue({
    done: Promise.resolve(),
    cancel: jest.fn(),
  }),
}));

// Mock speech recognition hook
jest.mock('@/hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: () => ({
    isListening: false,
    pulseAnim: { setValue: jest.fn(), interpolate: jest.fn().mockReturnValue(1) },
    handleMicPress: jest.fn(),
    stopAndGuard: jest.fn(),
  }),
}));

// Mock ChatMessageItem
jest.mock('@/components/chat/ChatMessageItem', () => ({
  ChatMessageItem: () => {
    const { View } = require('react-native');
    return <View testID="chat-message-item" />;
  },
}));

// Mock ChatInputBar with a simplified version that exposes testIDs
jest.mock('@/components/chat/ChatInputBar', () => ({
  ChatInputBar: () => {
    const { View, Text } = require('react-native');
    return (
      <View testID="chat-input-bar">
        <Text>ChatInputBar</Text>
      </View>
    );
  },
}));

// Mock markdown
jest.mock('@ronradtke/react-native-markdown-display', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: string }) => <Text>{children}</Text>,
  };
});

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
  recipeId: 'recipe-1',
  recipeName: 'Pasta Carbonara',
  currentStep: 2,
  totalSteps: 5,
  stepInstruction: 'Boil the pasta',
};

describe('IrmixyCookingModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders when visible with greeting empty state', () => {
      render(<IrmixyCookingModal {...defaultProps} />);

      expect(screen.getByText('How can I help with your recipe?')).toBeTruthy();
    });

    it('shows Irmixy title in header', () => {
      render(<IrmixyCookingModal {...defaultProps} />);

      expect(screen.getByText('Irmixy')).toBeTruthy();
    });

    it('shows context hint in header', () => {
      render(<IrmixyCookingModal {...defaultProps} />);

      expect(screen.getByText('Pasta Carbonara - Step 2/5')).toBeTruthy();
    });

    it('renders ChatInputBar', () => {
      render(<IrmixyCookingModal {...defaultProps} />);

      expect(screen.getByTestId('chat-input-bar')).toBeTruthy();
    });
  });

  // ============================================================
  // CLOSE BUTTON TESTS
  // ============================================================

  describe('close button', () => {
    it('has a close button that calls onClose', () => {
      const onClose = jest.fn();
      render(<IrmixyCookingModal {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByLabelText('Close');
      fireEvent.press(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // VISIBILITY TESTS
  // ============================================================

  describe('visibility', () => {
    it('does not render greeting when visible is false', () => {
      render(<IrmixyCookingModal {...defaultProps} visible={false} />);

      // In the test environment, Modal with visible=false does not render children
      expect(screen.queryByText('How can I help with your recipe?')).toBeNull();
    });
  });
});
