import { renderHook, waitFor } from '@testing-library/react-native';
import { useVoiceChat } from '../useVoiceChat';
import type { ChatMessage } from '@/services/chatService';

jest.mock('@/contexts/UserProfileContext', () => ({
  useUserProfile: () => ({ userProfile: null }),
}));

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en' }),
}));

jest.mock('@/contexts/MeasurementContext', () => ({
  useMeasurement: () => ({ measurementSystem: 'metric' }),
}));

jest.mock('@/services/voice/VoiceProviderFactory', () => ({
  VoiceProviderFactory: {
    create: jest.fn(() => ({
      on: jest.fn(),
      off: jest.fn(),
      destroy: jest.fn(),
      initialize: jest.fn(),
      startConversation: jest.fn(),
      stopConversation: jest.fn(),
      setContext: jest.fn(),
      sendToolResult: jest.fn(),
    })),
  },
}));

function createMessage(id: string, content: string): ChatMessage {
  return {
    id,
    role: 'assistant',
    content,
    createdAt: new Date(),
  };
}

describe('useVoiceChat', () => {
  it('syncs transcript messages when sessionId changes', async () => {
    const firstSessionMessages = [createMessage('s1-msg', 'session one message')];
    const secondSessionMessages = [createMessage('s2-msg', 'session two message')];

    const { result, rerender } = renderHook(
      ({ sessionId, messages }) =>
        useVoiceChat({
          sessionId,
          initialTranscriptMessages: messages,
        }),
      {
        initialProps: {
          sessionId: 'session-1',
          messages: firstSessionMessages,
        },
      }
    );

    expect(result.current.transcriptMessages[0]?.id).toBe('s1-msg');

    rerender({
      sessionId: 'session-2',
      messages: secondSessionMessages,
    });

    await waitFor(() => {
      expect(result.current.transcriptMessages[0]?.id).toBe('s2-msg');
      expect(result.current.transcriptMessages[0]?.content).toBe('session two message');
    });
  });

  it('clears transcript when parent resets messages to empty', async () => {
    const initialMessages = [createMessage('msg-1', 'hello')];

    const { result, rerender } = renderHook(
      ({ messages }) =>
        useVoiceChat({
          sessionId: 'session-1',
          initialTranscriptMessages: messages,
        }),
      {
        initialProps: { messages: initialMessages },
      }
    );

    expect(result.current.transcriptMessages).toHaveLength(1);

    rerender({ messages: [] });

    await waitFor(() => {
      expect(result.current.transcriptMessages).toEqual([]);
    });
  });
});
