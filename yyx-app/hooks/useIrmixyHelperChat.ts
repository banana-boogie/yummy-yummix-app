import { useState, useEffect } from 'react';
import { useCookingSession } from '@/contexts/CookingSessionContext';

/**
 * Encapsulates IrmixyCookingModal visibility + CookingSession chat state.
 * Use this on any screen that shows IrmixyCookingModal to get a single
 * source of truth for modal state and session carryover.
 *
 * Resets chat state on unmount so switching recipes starts fresh.
 */
export function useIrmixyHelperChat() {
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

  // Clear Irmixy state when the screen unmounts (e.g. navigating away from a recipe)
  // so the next recipe's cooking guide starts with a fresh session.
  useEffect(() => {
    return () => resetChat();
  }, [resetChat]);

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
