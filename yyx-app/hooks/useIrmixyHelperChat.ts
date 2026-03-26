import { useState, useEffect } from 'react';
import { useCookingSession } from '@/contexts/CookingSessionContext';

/**
 * Encapsulates IrmixyCookingModal visibility + CookingSession chat state.
 * Use this on any screen that shows IrmixyCookingModal to get a single
 * source of truth for modal state and session carryover.
 *
 * Claims the cooking session for the given recipeId. If a different recipe
 * previously owned the session, it resets automatically. This works across
 * mount boundaries because the provider persists even when screens remount.
 */
export function useIrmixyHelperChat(recipeId?: string) {
  const [isVisible, setIsVisible] = useState(false);
  const {
    claimForRecipe,
    irmixyChatSessionId,
    setIrmixyChatSessionId,
    irmixyChatMessages,
    setIrmixyChatMessages,
    irmixyVoiceTranscriptMessages,
    setIrmixyVoiceTranscriptMessages,
  } = useCookingSession();

  // Claim the session for this recipe on mount and when recipeId changes.
  // The provider handles reset if a different recipe previously owned it.
  useEffect(() => {
    if (recipeId) {
      claimForRecipe(recipeId);
    }
  }, [recipeId, claimForRecipe]);

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
