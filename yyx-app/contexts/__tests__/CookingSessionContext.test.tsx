import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { CookingSessionProvider, useCookingSession } from '@/contexts/CookingSessionContext';

function wrapper({ children }: { children: React.ReactNode }) {
  return <CookingSessionProvider>{children}</CookingSessionProvider>;
}

describe('CookingSessionContext', () => {
  describe('Irmixy chat state', () => {
    it('starts with null session ID and empty messages', () => {
      const { result } = renderHook(() => useCookingSession(), { wrapper });
      expect(result.current.irmixyChatSessionId).toBeNull();
      expect(result.current.irmixyChatMessages).toEqual([]);
      expect(result.current.irmixyVoiceTranscriptMessages).toEqual([]);
    });

    it('persists Irmixy chat session ID', () => {
      const { result } = renderHook(() => useCookingSession(), { wrapper });

      act(() => {
        result.current.setIrmixyChatSessionId('irmixy-session-1');
      });

      expect(result.current.irmixyChatSessionId).toBe('irmixy-session-1');
    });

    it('persists Irmixy chat messages', () => {
      const { result } = renderHook(() => useCookingSession(), { wrapper });

      const messages = [
        { id: 'msg-1', role: 'assistant' as const, content: 'Hello!', createdAt: new Date() },
        { id: 'msg-2', role: 'user' as const, content: 'Help me!', createdAt: new Date() },
      ];

      act(() => {
        result.current.setIrmixyChatMessages(messages);
      });

      expect(result.current.irmixyChatMessages).toHaveLength(2);
      expect(result.current.irmixyChatMessages[0].content).toBe('Hello!');
    });

    it('persists voice transcript messages', () => {
      const { result } = renderHook(() => useCookingSession(), { wrapper });

      const messages = [
        { id: 'voice-1', role: 'user' as const, content: 'Test', createdAt: new Date() },
      ];

      act(() => {
        result.current.setIrmixyVoiceTranscriptMessages(messages);
      });

      expect(result.current.irmixyVoiceTranscriptMessages).toHaveLength(1);
      expect(result.current.irmixyVoiceTranscriptMessages[0].content).toBe('Test');
    });
  });

  describe('claimForRecipe', () => {
    it('same recipe keeps session', () => {
      const { result } = renderHook(() => useCookingSession(), { wrapper });

      act(() => {
        result.current.setIrmixyChatSessionId('session-1');
        result.current.setIrmixyChatMessages([
          { id: 'msg-1', role: 'assistant' as const, content: 'Hello', createdAt: new Date() },
        ]);
        result.current.claimForRecipe('recipe-A');
      });

      // Claim again for the same recipe — session should persist
      act(() => {
        result.current.claimForRecipe('recipe-A');
      });

      expect(result.current.irmixyChatSessionId).toBe('session-1');
      expect(result.current.irmixyChatMessages).toHaveLength(1);
    });

    it('different recipe resets session', () => {
      const { result } = renderHook(() => useCookingSession(), { wrapper });

      act(() => {
        result.current.setIrmixyChatSessionId('session-1');
        result.current.setIrmixyChatMessages([
          { id: 'msg-1', role: 'assistant' as const, content: 'Hello', createdAt: new Date() },
        ]);
        result.current.claimForRecipe('recipe-A');
      });

      // Claim for a different recipe — should reset
      act(() => {
        result.current.claimForRecipe('recipe-B');
      });

      expect(result.current.irmixyChatSessionId).toBeNull();
      expect(result.current.irmixyChatMessages).toEqual([]);
    });
  });
});
