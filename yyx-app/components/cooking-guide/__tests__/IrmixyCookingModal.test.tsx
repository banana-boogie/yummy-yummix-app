/**
 * IrmixyCookingModal Component Tests
 *
 * Tests for the full-screen modal that opens from the cooking guide.
 * The modal now reuses ChatScreen and VoiceChatScreen as embedded
 * components. Tests cover rendering, header, mode toggle, and close.
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
      'chat.cookingModal.switchToVoice': 'Switch to voice',
      'chat.cookingModal.switchToText': 'Switch to text',
      'common.close': 'Close',
    };
    if (key === 'chat.cookingModal.contextHint') {
      return `${params?.recipeName} - Step ${params?.step}/${params?.total}`;
    }
    return translations[key] || key;
  },
}));

// Mock safe area
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

// Mock ChatScreen
jest.mock('@/components/chat/ChatScreen', () => ({
  ChatScreen: (props: Record<string, unknown>) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="chat-screen">
        <Text>{String(props.emptyStateGreeting ?? '')}</Text>
      </View>
    );
  },
}));

// Mock VoiceChatScreen
jest.mock('@/components/chat/VoiceChatScreen', () => ({
  VoiceChatScreen: () => {
    const { View, Text } = require('react-native');
    return (
      <View testID="voice-chat-screen">
        <Text>VoiceChatScreen</Text>
      </View>
    );
  },
}));

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
  recipeContext: {
    type: 'cooking' as const,
    recipeId: 'recipe-1',
    recipeTitle: 'Pasta Carbonara',
    currentStep: 2,
    totalSteps: 5,
    stepInstructions: 'Boil the pasta',
  },
};

describe('IrmixyCookingModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders ChatScreen in text mode by default', () => {
      render(<IrmixyCookingModal {...defaultProps} />);

      expect(screen.getByTestId('chat-screen')).toBeTruthy();
      expect(screen.queryByTestId('voice-chat-screen')).toBeNull();
    });

    it('shows Irmixy title in header', () => {
      render(<IrmixyCookingModal {...defaultProps} />);

      expect(screen.getByText('Irmixy')).toBeTruthy();
    });

    it('shows context hint in header', () => {
      render(<IrmixyCookingModal {...defaultProps} />);

      expect(screen.getByText('Pasta Carbonara - Step 2/5')).toBeTruthy();
    });

    it('passes emptyStateGreeting to ChatScreen', () => {
      render(<IrmixyCookingModal {...defaultProps} />);

      expect(screen.getByText('How can I help with your recipe?')).toBeTruthy();
    });
  });

  // ============================================================
  // MODE TOGGLE TESTS
  // ============================================================

  describe('mode toggle', () => {
    it('switches to voice mode when toggle is pressed', () => {
      render(<IrmixyCookingModal {...defaultProps} />);

      const toggleButton = screen.getByLabelText('Switch to voice');
      fireEvent.press(toggleButton);

      expect(screen.getByTestId('voice-chat-screen')).toBeTruthy();
      expect(screen.queryByTestId('chat-screen')).toBeNull();
    });

    it('switches back to text mode from voice mode', () => {
      render(<IrmixyCookingModal {...defaultProps} />);

      // Switch to voice
      fireEvent.press(screen.getByLabelText('Switch to voice'));
      expect(screen.getByTestId('voice-chat-screen')).toBeTruthy();

      // Switch back to text
      fireEvent.press(screen.getByLabelText('Switch to text'));
      expect(screen.getByTestId('chat-screen')).toBeTruthy();
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
    it('does not render content when visible is false', () => {
      render(<IrmixyCookingModal {...defaultProps} visible={false} />);

      expect(screen.queryByTestId('chat-screen')).toBeNull();
    });
  });
});
