import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { CookingSessionProvider, useCookingSession } from '@/contexts/CookingSessionContext';
import type { CookingSession } from '@/contexts/CookingSessionContext';

function wrapper({ children }: { children: React.ReactNode }) {
  return <CookingSessionProvider>{children}</CookingSessionProvider>;
}

const mockSession: CookingSession = {
  recipeId: 'recipe-123',
  recipeName: 'Tacos al pastor',
  currentStep: 2,
  totalSteps: 5,
  isCustom: false,
};

describe('CookingSessionContext', () => {
  it('starts with no active session', () => {
    const { result } = renderHook(() => useCookingSession(), { wrapper });
    expect(result.current.activeCookingSession).toBeNull();
  });

  it('starts a cooking session', () => {
    const { result } = renderHook(() => useCookingSession(), { wrapper });

    act(() => {
      result.current.startCookingSession(mockSession);
    });

    expect(result.current.activeCookingSession).toEqual(mockSession);
  });

  it('updates the current step', () => {
    const { result } = renderHook(() => useCookingSession(), { wrapper });

    act(() => {
      result.current.startCookingSession(mockSession);
    });

    act(() => {
      result.current.updateStep(4);
    });

    expect(result.current.activeCookingSession?.currentStep).toBe(4);
    // Other fields unchanged
    expect(result.current.activeCookingSession?.recipeId).toBe('recipe-123');
  });

  it('does not crash when updating step with no session', () => {
    const { result } = renderHook(() => useCookingSession(), { wrapper });

    act(() => {
      result.current.updateStep(3);
    });

    expect(result.current.activeCookingSession).toBeNull();
  });

  it('clears the cooking session', () => {
    const { result } = renderHook(() => useCookingSession(), { wrapper });

    act(() => {
      result.current.startCookingSession(mockSession);
    });
    expect(result.current.activeCookingSession).not.toBeNull();

    act(() => {
      result.current.clearCookingSession();
    });
    expect(result.current.activeCookingSession).toBeNull();
  });

  it('replaces session when starting a new one', () => {
    const { result } = renderHook(() => useCookingSession(), { wrapper });

    act(() => {
      result.current.startCookingSession(mockSession);
    });

    const newSession: CookingSession = {
      recipeId: 'recipe-456',
      recipeName: 'Enchiladas suizas',
      currentStep: 1,
      totalSteps: 3,
      isCustom: true,
      from: 'chat',
    };

    act(() => {
      result.current.startCookingSession(newSession);
    });

    expect(result.current.activeCookingSession).toEqual(newSession);
  });

  // ============================================================
  // IRMIXY CHAT STATE PERSISTENCE
  // ============================================================

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

    it('clears Irmixy chat state when clearing cooking session', () => {
      const { result } = renderHook(() => useCookingSession(), { wrapper });

      act(() => {
        result.current.startCookingSession(mockSession);
        result.current.setIrmixyChatSessionId('irmixy-session-1');
        result.current.setIrmixyChatMessages([
          { id: 'msg-1', role: 'assistant' as const, content: 'Hello!', createdAt: new Date() },
        ]);
        result.current.setIrmixyVoiceTranscriptMessages([
          { id: 'voice-1', role: 'user' as const, content: 'Test', createdAt: new Date() },
        ]);
      });

      expect(result.current.irmixyChatSessionId).toBe('irmixy-session-1');
      expect(result.current.irmixyChatMessages).toHaveLength(1);
      expect(result.current.irmixyVoiceTranscriptMessages).toHaveLength(1);

      act(() => {
        result.current.clearCookingSession();
      });

      expect(result.current.activeCookingSession).toBeNull();
      expect(result.current.irmixyChatSessionId).toBeNull();
      expect(result.current.irmixyChatMessages).toEqual([]);
      expect(result.current.irmixyVoiceTranscriptMessages).toEqual([]);
    });
  });
});
