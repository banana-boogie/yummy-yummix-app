import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import type { ChatMessage } from '@/services/chatService';
import ChatPage from '@/app/(tabs)/chat/index';

jest.mock('@/i18n', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      'chat.title': 'Irmixy',
    };
    return translations[key] || key;
  },
}));

jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    Stack: {
      Screen: ({ options }: { options?: { headerRight?: () => React.ReactElement; headerLeft?: () => React.ReactElement } }) => {
        const headerRight = options?.headerRight?.();
        const headerLeft = options?.headerLeft?.();

        return (
          <View>
            {headerRight ? React.cloneElement(headerRight, { testID: 'toggle-mode' }) : null}
            {headerLeft ? React.cloneElement(headerLeft, { testID: 'sessions-menu' }) : null}
          </View>
        );
      },
    },
    useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn() }),
  };
});

jest.mock('@/contexts/CookingSessionContext', () => ({
  useCookingSession: () => ({ activeCookingSession: null, clearCookingSession: jest.fn() }),
  CookingSessionProvider: ({ children }: { children: any }) => children,
}));

jest.mock('@/components/chat/ChatSessionsMenu', () => ({
  ChatSessionsMenu: () => {
    const { View } = require('react-native');
    return <View />;
  },
}));

jest.mock('@/components/chat/ChatScreen', () => ({
  ChatScreen: ({ messages = [], onMessagesChange }: { messages: ChatMessage[]; onMessagesChange?: (messages: ChatMessage[]) => void }) => {
    const React = require('react');
    const { View, Text, TouchableOpacity } = require('react-native');

    return (
      <View>
        <Text>{`TextCount:${messages.length}`}</Text>
        <TouchableOpacity
          onPress={() => {
            const next = [
              ...messages,
              {
                id: `text-${messages.length + 1}`,
                role: 'user' as const,
                content: 'text message',
                createdAt: new Date(),
              },
            ];
            onMessagesChange?.(next);
          }}
        >
          <Text>AddText</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

jest.mock('@/components/chat/VoiceChatScreen', () => ({
  VoiceChatScreen: ({ transcriptMessages = [], onTranscriptChange }: { transcriptMessages: ChatMessage[]; onTranscriptChange?: (messages: ChatMessage[]) => void }) => {
    const React = require('react');
    const { View, Text, TouchableOpacity } = require('react-native');

    return (
      <View>
        <Text>{`VoiceCount:${transcriptMessages.length}`}</Text>
        <TouchableOpacity
          onPress={() => {
            const next = [
              ...transcriptMessages,
              {
                id: `voice-${transcriptMessages.length + 1}`,
                role: 'assistant' as const,
                content: 'voice message',
                createdAt: new Date(),
              },
            ];
            onTranscriptChange?.(next);
          }}
        >
          <Text>AddVoice</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

describe('ChatPage mode switching', () => {
  it('preserves each mode\'s messages independently across toggles', () => {
    render(<ChatPage />);

    // Starts in text mode by default
    expect(screen.getByText('TextCount:0')).toBeTruthy();

    // Add a text message
    fireEvent.press(screen.getByText('AddText'));
    expect(screen.getByText('TextCount:1')).toBeTruthy();

    // Switch to voice — voice starts empty (separate state)
    fireEvent.press(screen.getByTestId('toggle-mode'));
    expect(screen.getByText('VoiceCount:0')).toBeTruthy();

    // Add a voice message
    fireEvent.press(screen.getByText('AddVoice'));
    expect(screen.getByText('VoiceCount:1')).toBeTruthy();

    // Switch back to text — text message still preserved
    fireEvent.press(screen.getByTestId('toggle-mode'));
    expect(screen.getByText('TextCount:1')).toBeTruthy();

    // Switch to voice — voice message still preserved
    fireEvent.press(screen.getByTestId('toggle-mode'));
    expect(screen.getByText('VoiceCount:1')).toBeTruthy();

    // Switch to text again — text message still preserved
    fireEvent.press(screen.getByTestId('toggle-mode'));
    expect(screen.getByText('TextCount:1')).toBeTruthy();
  });
});
