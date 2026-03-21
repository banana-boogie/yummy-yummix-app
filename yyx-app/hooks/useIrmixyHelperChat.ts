import { useState } from 'react';
import { useCookingSession } from '@/contexts/CookingSessionContext';

/**
 * Encapsulates IrmixyCookingModal visibility + CookingSession chat state.
 * Use this on any screen that shows IrmixyCookingModal to get a single
 * source of truth for modal state and session carryover.
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
  } = useCookingSession();

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
