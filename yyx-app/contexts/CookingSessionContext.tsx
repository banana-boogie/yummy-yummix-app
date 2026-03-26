/**
 * Persists Irmixy chat state (session ID, messages, voice transcripts)
 * across cooking step navigation so conversations carry over.
 *
 * Messages use refs (not state) to avoid re-rendering all context consumers
 * on every stream token. The ChatScreen manages its own render cycle via
 * the onMessagesChange prop — the context is only for persistence.
 */
import React, { createContext, useContext, useState, useRef, useCallback, useMemo, type ReactNode } from 'react';
import type { ChatMessage } from '@/services/chatService';

interface CookingSessionContextType {
  /** Irmixy chat session ID — persists across step navigation */
  irmixyChatSessionId: string | null;
  setIrmixyChatSessionId: (id: string | null) => void;
  /** Irmixy text chat messages — persists across step navigation (ref-backed, no re-render) */
  irmixyChatMessages: ChatMessage[];
  setIrmixyChatMessages: (messages: ChatMessage[]) => void;
  /** Irmixy voice transcript messages — persists across step navigation (ref-backed, no re-render) */
  irmixyVoiceTranscriptMessages: ChatMessage[];
  setIrmixyVoiceTranscriptMessages: (messages: ChatMessage[]) => void;
}

const noop = () => {};

const CookingSessionContext = createContext<CookingSessionContextType>({
  irmixyChatSessionId: null,
  setIrmixyChatSessionId: noop,
  irmixyChatMessages: [],
  setIrmixyChatMessages: noop,
  irmixyVoiceTranscriptMessages: [],
  setIrmixyVoiceTranscriptMessages: noop,
});

export function CookingSessionProvider({ children }: { children: ReactNode }) {
  const [irmixyChatSessionId, setIrmixyChatSessionId] = useState<string | null>(null);

  // Use refs for messages to avoid re-rendering all consumers on every stream token.
  // The ChatScreen handles its own rendering; the context just stores for persistence.
  const chatMessagesRef = useRef<ChatMessage[]>([]);
  const voiceTranscriptMessagesRef = useRef<ChatMessage[]>([]);

  const setChatMessages = useCallback((messages: ChatMessage[]) => {
    chatMessagesRef.current = messages;
  }, []);

  const setVoiceTranscriptMessages = useCallback((messages: ChatMessage[]) => {
    voiceTranscriptMessagesRef.current = messages;
  }, []);

  // Only re-render consumers when session ID changes (not on every message update)
  const value = useMemo<CookingSessionContextType>(
    () => ({
      irmixyChatSessionId,
      setIrmixyChatSessionId,
      get irmixyChatMessages() { return chatMessagesRef.current; },
      setIrmixyChatMessages: setChatMessages,
      get irmixyVoiceTranscriptMessages() { return voiceTranscriptMessagesRef.current; },
      setIrmixyVoiceTranscriptMessages: setVoiceTranscriptMessages,
    }),
    [irmixyChatSessionId, setChatMessages, setVoiceTranscriptMessages],
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
