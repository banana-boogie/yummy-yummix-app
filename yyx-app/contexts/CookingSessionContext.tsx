/**
 * Persists active cooking session state across tab navigation.
 * When a user is in the cooking guide and switches to Irmixy chat,
 * this context remembers where they were so they can return.
 *
 * Also persists Irmixy chat state (session ID, messages, voice transcripts)
 * so conversations carry over when navigating between cooking steps.
 */
import React, { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { ChatMessage } from '@/services/chatService';

export interface CookingSession {
  recipeId: string;
  recipeName: string;
  currentStep: number;
  totalSteps: number;
  /** Whether this is a custom (AI-generated) recipe */
  isCustom: boolean;
  /** Optional 'from' param for custom recipe navigation */
  from?: string;
}

interface CookingSessionContextType {
  activeCookingSession: CookingSession | null;
  startCookingSession: (session: CookingSession) => void;
  updateStep: (step: number) => void;
  clearCookingSession: () => void;
  /** Irmixy chat session ID — persists across step navigation */
  irmixyChatSessionId: string | null;
  setIrmixyChatSessionId: (id: string | null) => void;
  /** Irmixy text chat messages — persists across step navigation */
  irmixyChatMessages: ChatMessage[];
  setIrmixyChatMessages: (messages: ChatMessage[]) => void;
  /** Irmixy voice transcript messages — persists across step navigation */
  irmixyVoiceTranscriptMessages: ChatMessage[];
  setIrmixyVoiceTranscriptMessages: (messages: ChatMessage[]) => void;
}

const noop = () => {};

const CookingSessionContext = createContext<CookingSessionContextType>({
  activeCookingSession: null,
  startCookingSession: noop,
  updateStep: noop,
  clearCookingSession: noop,
  irmixyChatSessionId: null,
  setIrmixyChatSessionId: noop,
  irmixyChatMessages: [],
  setIrmixyChatMessages: noop,
  irmixyVoiceTranscriptMessages: [],
  setIrmixyVoiceTranscriptMessages: noop,
});

export function CookingSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CookingSession | null>(null);
  const [irmixyChatSessionId, setIrmixyChatSessionId] = useState<string | null>(null);
  const [irmixyChatMessages, setIrmixyChatMessages] = useState<ChatMessage[]>([]);
  const [irmixyVoiceTranscriptMessages, setIrmixyVoiceTranscriptMessages] = useState<ChatMessage[]>([]);

  const startCookingSession = useCallback((newSession: CookingSession) => {
    setSession(newSession);
  }, []);

  const updateStep = useCallback((step: number) => {
    setSession((prev) => (prev ? { ...prev, currentStep: step } : null));
  }, []);

  const clearCookingSession = useCallback(() => {
    setSession(null);
    setIrmixyChatSessionId(null);
    setIrmixyChatMessages([]);
    setIrmixyVoiceTranscriptMessages([]);
  }, []);

  const value = useMemo<CookingSessionContextType>(
    () => ({
      activeCookingSession: session,
      startCookingSession,
      updateStep,
      clearCookingSession,
      irmixyChatSessionId,
      setIrmixyChatSessionId,
      irmixyChatMessages,
      setIrmixyChatMessages,
      irmixyVoiceTranscriptMessages,
      setIrmixyVoiceTranscriptMessages,
    }),
    [session, startCookingSession, updateStep, clearCookingSession,
     irmixyChatSessionId, irmixyChatMessages, irmixyVoiceTranscriptMessages],
  );

  return (
    <CookingSessionContext.Provider value={value}>
      {children}
    </CookingSessionContext.Provider>
  );
}

export function useCookingSession() {
  return useContext(CookingSessionContext);
}

export { CookingSessionContext };
