/**
 * Chat Route Web Regression Tests
 *
 * Verifies web defaults to text mode and hides voice toggle in the header.
 */

import React from 'react';
import { Platform } from 'react-native';
import { render } from '@testing-library/react-native';
import ChatPage from '../index';

const mockStackScreen = jest.fn((_props: any) => null);
const mockChatScreen = jest.fn((_props: any) => null);
const mockVoiceChatScreen = jest.fn((_props: any) => null);

jest.mock('expo-router', () => ({
  Stack: {
    Screen: (props: any) => {
      mockStackScreen(props);
      return null;
    },
  },
}));

jest.mock('@/i18n', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      'chat.title': 'Irmixy',
    };
    return translations[key] || key;
  },
}));

jest.mock('@/components/chat/ChatScreen', () => ({
  ChatScreen: (props: any) => {
    mockChatScreen(props);
    return null;
  },
}));

jest.mock('@/components/chat/VoiceChatScreen', () => ({
  VoiceChatScreen: (props: any) => {
    mockVoiceChatScreen(props);
    return null;
  },
}));

jest.mock('@/components/chat/ChatSessionsMenu', () => ({
  ChatSessionsMenu: () => null,
}));
describe('chat route web defaults', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'web';
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
  });

  it('renders text chat by default on web', () => {
    render(<ChatPage />);

    expect(mockChatScreen).toHaveBeenCalledTimes(1);
    expect(mockVoiceChatScreen).not.toHaveBeenCalled();
  });

  it('hides the voice toggle button in web header', () => {
    render(<ChatPage />);

    const firstCall = mockStackScreen.mock.calls[0];
    const options = firstCall?.[0]?.options;

    expect(options?.headerRight?.()).toBeUndefined();
  });
});
