import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type StopSessionFn = () => void;

interface VoiceSessionEntry {
  id: string;
  stop: StopSessionFn;
  registeredAt: number;
}

interface VoiceSessionContextValue {
  registerSession: (id: string, stop: StopSessionFn) => void;
  unregisterSession: (id: string) => void;
  stopAllSessions: () => void;
  hasActiveSession: boolean;
}

const noop = () => {};

const VoiceSessionContext = createContext<VoiceSessionContextValue>({
  registerSession: noop,
  unregisterSession: noop,
  stopAllSessions: noop,
  hasActiveSession: false,
});

export function VoiceSessionProvider({ children }: { children: ReactNode }) {
  const sessionsRef = useRef<Map<string, VoiceSessionEntry>>(new Map());
  const [, setRegistryVersion] = useState(0);

  const notifyRegistryChange = useCallback(() => {
    setRegistryVersion(v => v + 1);
  }, []);

  const registerSession = useCallback((id: string, stop: StopSessionFn) => {
    const existing = sessionsRef.current.get(id);
    if (existing && existing.stop === stop) {
      return;
    }

    sessionsRef.current.set(id, {
      id,
      stop,
      registeredAt: Date.now(),
    });
    notifyRegistryChange();
  }, [notifyRegistryChange]);

  const unregisterSession = useCallback((id: string) => {
    if (!sessionsRef.current.has(id)) {
      return;
    }

    sessionsRef.current.delete(id);
    notifyRegistryChange();
  }, [notifyRegistryChange]);

  const stopAllSessions = useCallback(() => {
    for (const entry of sessionsRef.current.values()) {
      try {
        entry.stop();
      } catch (error) {
        console.error('[VoiceSession] Failed to stop session:', entry.id, error);
      }
    }

    if (sessionsRef.current.size > 0) {
      sessionsRef.current.clear();
      notifyRegistryChange();
    }
  }, [notifyRegistryChange]);

  const hasActiveSession = sessionsRef.current.size > 0;

  const value = useMemo<VoiceSessionContextValue>(() => ({
    registerSession,
    unregisterSession,
    stopAllSessions,
    hasActiveSession,
  }), [registerSession, unregisterSession, stopAllSessions, hasActiveSession]);

  return (
    <VoiceSessionContext.Provider value={value}>
      {children}
    </VoiceSessionContext.Provider>
  );
}

export function useVoiceSession() {
  return useContext(VoiceSessionContext);
}

export { VoiceSessionContext };
