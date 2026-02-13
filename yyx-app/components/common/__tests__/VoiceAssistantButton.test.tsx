/**
 * VoiceAssistantButton Component Tests
 *
 * Tests for the voice assistant button that triggers voice conversations.
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

// Mock i18n
jest.mock('@/i18n', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      'chat.voice.connecting': 'Connecting...',
      'chat.voice.greeting': 'Hi! How can I help you cook today?',
      'chat.voice.userPrefix': 'You: ',
      'chat.voice.errorPrefix': 'Error: ',
    };
    return translations[key] || key;
  },
}));

// Mock the useVoiceChat hook with different states
const mockStartConversation = jest.fn();
const mockStopConversation = jest.fn();

let mockVoiceChatState = {
  status: 'idle' as 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'error',
  transcript: null as string | null,
  response: null as string | null,
  error: null as string | null,
  quotaInfo: null,
  startConversation: mockStartConversation,
  stopConversation: mockStopConversation,
};

jest.mock('@/hooks/useVoiceChat', () => ({
  useVoiceChat: () => mockVoiceChatState,
}));

// Mock IrmixyAvatar to avoid animation complexity
jest.mock('@/components/chat/IrmixyAvatar', () => ({
  IrmixyAvatar: ({ state, size }: { state: string; size: number }) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="irmixy-avatar">
        <Text>{state}</Text>
      </View>
    );
  },
}));

import { VoiceAssistantButton } from '../VoiceAssistantButton';

describe('VoiceAssistantButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVoiceChatState = {
      status: 'idle',
      transcript: null,
      response: null,
      error: null,
      quotaInfo: null,
      startConversation: mockStartConversation,
      stopConversation: mockStopConversation,
    };
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders in idle state', () => {
      const { toJSON } = render(<VoiceAssistantButton />);

      expect(toJSON()).not.toBeNull();
      expect(screen.getByTestId('irmixy-avatar')).toBeTruthy();
    });

    it('shows connecting indicator when connecting', () => {
      mockVoiceChatState.status = 'connecting';

      render(<VoiceAssistantButton />);

      expect(screen.getByText('Connecting...')).toBeTruthy();
    });

    it('shows error message when error occurs', () => {
      mockVoiceChatState.status = 'error';
      mockVoiceChatState.error = 'Connection failed';

      render(<VoiceAssistantButton />);

      expect(screen.getByText('Error: Connection failed')).toBeTruthy();
    });
  });

  // ============================================================
  // INTERACTION TESTS
  // ============================================================

  describe('interactions', () => {
    it('starts conversation on press when idle', async () => {
      const { UNSAFE_root } = render(<VoiceAssistantButton />);

      // Find all elements that have onPress
      const findPressable = (node: any): any => {
        if (node.props?.onPress && typeof node.props.onPress === 'function') {
          return node;
        }
        if (node.children) {
          for (const child of Array.isArray(node.children) ? node.children : [node.children]) {
            if (typeof child === 'object' && child !== null) {
              const found = findPressable(child);
              if (found) return found;
            }
          }
        }
        return null;
      };

      const button = findPressable(UNSAFE_root);
      expect(button).toBeTruthy();

      if (button) {
        await fireEvent.press(button);
      }

      expect(mockStartConversation).toHaveBeenCalledTimes(1);
    });

    it('stops conversation on press when listening', async () => {
      mockVoiceChatState.status = 'listening';

      const { UNSAFE_root } = render(<VoiceAssistantButton />);

      const findPressable = (node: any): any => {
        if (node.props?.onPress && typeof node.props.onPress === 'function') {
          return node;
        }
        if (node.children) {
          for (const child of Array.isArray(node.children) ? node.children : [node.children]) {
            if (typeof child === 'object' && child !== null) {
              const found = findPressable(child);
              if (found) return found;
            }
          }
        }
        return null;
      };

      const button = findPressable(UNSAFE_root);
      if (button) {
        await fireEvent.press(button);
      }

      expect(mockStopConversation).toHaveBeenCalledTimes(1);
    });

    it('stops conversation on press when speaking', async () => {
      mockVoiceChatState.status = 'speaking';

      const { UNSAFE_root } = render(<VoiceAssistantButton />);

      const findPressable = (node: any): any => {
        if (node.props?.onPress && typeof node.props.onPress === 'function') {
          return node;
        }
        if (node.children) {
          for (const child of Array.isArray(node.children) ? node.children : [node.children]) {
            if (typeof child === 'object' && child !== null) {
              const found = findPressable(child);
              if (found) return found;
            }
          }
        }
        return null;
      };

      const button = findPressable(UNSAFE_root);
      if (button) {
        await fireEvent.press(button);
      }

      expect(mockStopConversation).toHaveBeenCalledTimes(1);
    });

    it('does not respond to press during connecting state', async () => {
      mockVoiceChatState.status = 'connecting';

      const { UNSAFE_root } = render(<VoiceAssistantButton />);

      const findPressable = (node: any): any => {
        if (node.props?.onPress && typeof node.props.onPress === 'function') {
          return node;
        }
        if (node.children) {
          for (const child of Array.isArray(node.children) ? node.children : [node.children]) {
            if (typeof child === 'object' && child !== null) {
              const found = findPressable(child);
              if (found) return found;
            }
          }
        }
        return null;
      };

      const button = findPressable(UNSAFE_root);
      if (button) {
        await fireEvent.press(button);
      }

      expect(mockStartConversation).not.toHaveBeenCalled();
      expect(mockStopConversation).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // POSITION TESTS
  // ============================================================

  describe('positions', () => {
    it('renders with default position (bottom-right)', () => {
      const { toJSON } = render(<VoiceAssistantButton />);

      expect(toJSON()).not.toBeNull();
    });

    it('renders with inline position', () => {
      const { toJSON } = render(<VoiceAssistantButton position="inline" />);

      expect(toJSON()).not.toBeNull();
    });

    it('renders with bottom-center position', () => {
      const { toJSON } = render(<VoiceAssistantButton position="bottom-center" />);

      expect(toJSON()).not.toBeNull();
    });

    it('renders with top-right position', () => {
      const { toJSON } = render(<VoiceAssistantButton position="top-right" />);

      expect(toJSON()).not.toBeNull();
    });
  });

  // ============================================================
  // SIZE TESTS
  // ============================================================

  describe('sizes', () => {
    it('renders with small size', () => {
      const { toJSON } = render(<VoiceAssistantButton size="small" />);

      expect(toJSON()).not.toBeNull();
    });

    it('renders with medium size (default)', () => {
      const { toJSON } = render(<VoiceAssistantButton size="medium" />);

      expect(toJSON()).not.toBeNull();
    });

    it('renders with large size', () => {
      const { toJSON } = render(<VoiceAssistantButton size="large" />);

      expect(toJSON()).not.toBeNull();
    });
  });

  // ============================================================
  // TRANSCRIPT/RESPONSE DISPLAY TESTS
  // ============================================================

  describe('transcript and response display', () => {
    it('shows transcript when available', () => {
      mockVoiceChatState.status = 'processing';
      mockVoiceChatState.transcript = 'How do I make pasta?';

      render(<VoiceAssistantButton />);

      expect(screen.getByText('You: How do I make pasta?')).toBeTruthy();
    });

    it('shows response when available', () => {
      mockVoiceChatState.status = 'speaking';
      mockVoiceChatState.response = 'Here is how to make pasta...';

      render(<VoiceAssistantButton />);

      expect(screen.getByText('Irmixy: Here is how to make pasta...')).toBeTruthy();
    });

    it('shows both transcript and response when both available', () => {
      mockVoiceChatState.status = 'speaking';
      mockVoiceChatState.transcript = 'How do I make pasta?';
      mockVoiceChatState.response = 'Here is how...';

      render(<VoiceAssistantButton />);

      expect(screen.getByText('You: How do I make pasta?')).toBeTruthy();
      expect(screen.getByText('Irmixy: Here is how...')).toBeTruthy();
    });
  });

  // ============================================================
  // RECIPE CONTEXT TESTS
  // ============================================================

  describe('recipe context', () => {
    it('renders with recipe context', () => {
      const recipeContext = {
        recipeId: 'recipe-123',
        recipeName: 'Spaghetti Carbonara',
        currentStep: 2,
        totalSteps: 5,
      };

      const { toJSON } = render(<VoiceAssistantButton recipeContext={recipeContext} />);

      expect(toJSON()).not.toBeNull();
    });
  });
});
