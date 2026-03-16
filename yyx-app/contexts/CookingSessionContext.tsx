/**
 * Persists active cooking session state across tab navigation.
 * When a user is in the cooking guide and switches to Irmixy chat,
 * this context remembers where they were so they can return.
 */
import React, { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';

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
}

const noop = () => {};

const CookingSessionContext = createContext<CookingSessionContextType>({
  activeCookingSession: null,
  startCookingSession: noop,
  updateStep: noop,
  clearCookingSession: noop,
});

export function CookingSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CookingSession | null>(null);

  const startCookingSession = useCallback((newSession: CookingSession) => {
    setSession(newSession);
  }, []);

  const updateStep = useCallback((step: number) => {
    setSession((prev) => (prev ? { ...prev, currentStep: step } : null));
  }, []);

  const clearCookingSession = useCallback(() => {
    setSession(null);
  }, []);

  const value = useMemo<CookingSessionContextType>(
    () => ({
      activeCookingSession: session,
      startCookingSession,
      updateStep,
      clearCookingSession,
    }),
    [session, startCookingSession, updateStep, clearCookingSession],
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
