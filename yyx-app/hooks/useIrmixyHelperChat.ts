import { useState, useEffect, useRef } from 'react';
import { useCookingSession } from '@/contexts/CookingSessionContext';

/**
 * Encapsulates IrmixyCookingModal visibility + CookingSession chat state.
 * Use this on any screen that shows IrmixyCookingModal to get a single
 * source of truth for modal state and session carryover.
 *
 * Resets chat state when the recipe ID changes so switching recipes starts
 * fresh, but navigating between steps of the same recipe preserves the session.
 */
export function useIrmixyHelperChat(recipeId?: string) {
  const [isVisible, setIsVisible] = useState(false);
  const {
    irmixyChatSessionId,
    setIrmixyChatSessionId,
    irmixyChatMessages,
    setIrmixyChatMessages,
    irmixyVoiceTranscriptMessages,
    setIrmixyVoiceTranscriptMessages,
    resetChat,
  } = useCookingSession();

  // Reset chat when the recipe changes (not on every screen unmount).
  // This preserves the session across step-to-step navigation within the
  // same recipe while ensuring a fresh session for a new recipe.
  const prevRecipeIdRef = useRef(recipeId);
  useEffect(() => {
    if (prevRecipeIdRef.current && recipeId && prevRecipeIdRef.current !== recipeId) {
      resetChat();
    }
    prevRecipeIdRef.current = recipeId;
  }, [recipeId, resetChat]);

  return {
    isVisible,
    open: () => setIsVisible(true),
    close: () => setIsVisible(false),
    sessionProps: {
      externalSessionId: irmixyChatSessionId,
      onExternalSessionIdChange: setIrmixyChatSessionId,
      externalMessages: irmixyChatMessages,
      onExternalMessagesChange: setIrmixyChatMessages,
      externalVoiceTranscriptMessages: irmixyVoiceTranscriptMessages,
      onExternalVoiceTranscriptMessagesChange: setIrmixyVoiceTranscriptMessages,
    },
  };
}
