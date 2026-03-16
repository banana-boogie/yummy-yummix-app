/**
 * ChatInputBar Component Tests
 *
 * Tests for the chat input bar covering button states:
 * mic, send, stop, listening, and disabled states.
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { Platform, Animated } from 'react-native';
import { ChatInputBar } from '../ChatInputBar';

// Mock i18n
jest.mock('@/i18n', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      'chat.inputPlaceholder': 'Ask Irmixy...',
      'chat.sendButton': 'Send',
      'chat.stopGenerating': 'Stop generating',
      'chat.voice.tapToSpeak': 'Tap to speak',
      'chat.voice.listening': 'Listening...',
      'chat.voice.stopRecording': 'Stop recording',
    };
    return translations[key] || key;
  },
}));

const createDefaultProps = (overrides?: Partial<React.ComponentProps<typeof ChatInputBar>>) => ({
  inputText: '',
  setInputText: jest.fn(),
  isLoading: false,
  isListening: false,
  handleMicPress: jest.fn(),
  handleSend: jest.fn(),
  handleStop: jest.fn(),
  pulseAnim: new Animated.Value(1),
  bottomInset: 34,
  ...overrides,
});

describe('ChatInputBar', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default to ios (native) for most tests
    Platform.OS = 'ios';
  });

  afterAll(() => {
    Platform.OS = originalOS;
  });

  // ============================================================
  // BUTTON STATE TESTS
  // ============================================================

  describe('button states', () => {
    it('shows mic button when empty input on native', () => {
      const props = createDefaultProps();
      render(<ChatInputBar {...props} />);

      expect(screen.getByTestId('mic-button')).toBeTruthy();
      expect(screen.queryByTestId('send-button')).toBeNull();
      expect(screen.queryByTestId('stop-button')).toBeNull();
    });

    it('shows send button when input has text', () => {
      const props = createDefaultProps({ inputText: 'Hello' });
      render(<ChatInputBar {...props} />);

      expect(screen.getByTestId('send-button')).toBeTruthy();
      expect(screen.queryByTestId('mic-button')).toBeNull();
      expect(screen.queryByTestId('stop-button')).toBeNull();
    });

    it('shows stop button when isLoading and handleStop provided', () => {
      const props = createDefaultProps({ isLoading: true });
      render(<ChatInputBar {...props} />);

      expect(screen.getByTestId('stop-button')).toBeTruthy();
      expect(screen.queryByTestId('send-button')).toBeNull();
      expect(screen.queryByTestId('mic-button')).toBeNull();
    });

    it('shows pulsing stop button when isListening', () => {
      const props = createDefaultProps({ isListening: true });
      render(<ChatInputBar {...props} />);

      expect(screen.getByTestId('stop-listening-button')).toBeTruthy();
      expect(screen.queryByTestId('send-button')).toBeNull();
      expect(screen.queryByTestId('mic-button')).toBeNull();
    });

    it('shows disabled send button on web when input is empty', () => {
      Platform.OS = 'web' as any;
      const props = createDefaultProps();
      render(<ChatInputBar {...props} />);

      const sendButton = screen.getByTestId('send-button');
      expect(sendButton).toBeTruthy();
      expect(sendButton.props.accessibilityState?.disabled || sendButton.props.disabled).toBeTruthy();
    });
  });

  // ============================================================
  // DISABLED STATE TESTS
  // ============================================================

  describe('disabled state', () => {
    it('send button respects disabled prop', () => {
      const props = createDefaultProps({ inputText: 'Hello', disabled: true });
      render(<ChatInputBar {...props} />);

      const sendButton = screen.getByTestId('send-button');
      expect(sendButton.props.accessibilityState?.disabled || sendButton.props.disabled).toBeTruthy();
    });
  });

  // ============================================================
  // INTERACTION TESTS
  // ============================================================

  describe('interactions', () => {
    it('calls handleSend when send button pressed', () => {
      const handleSend = jest.fn();
      const props = createDefaultProps({ inputText: 'Hello', handleSend });
      render(<ChatInputBar {...props} />);

      fireEvent.press(screen.getByTestId('send-button'));

      expect(handleSend).toHaveBeenCalledTimes(1);
    });

    it('calls handleMicPress when mic button pressed', () => {
      const handleMicPress = jest.fn();
      const props = createDefaultProps({ handleMicPress });
      render(<ChatInputBar {...props} />);

      fireEvent.press(screen.getByTestId('mic-button'));

      expect(handleMicPress).toHaveBeenCalledTimes(1);
    });

    it('calls handleStop when stop button pressed', () => {
      const handleStop = jest.fn();
      const props = createDefaultProps({ isLoading: true, handleStop });
      render(<ChatInputBar {...props} />);

      fireEvent.press(screen.getByTestId('stop-button'));

      expect(handleStop).toHaveBeenCalledTimes(1);
    });
  });
});
