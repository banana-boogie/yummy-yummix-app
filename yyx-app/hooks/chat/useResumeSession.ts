import { useState, useCallback, useEffect, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import {
    ChatMessage,
    getLastSessionWithMessages,
    loadChatHistory,
} from '@/services/chatService';

interface UseResumeSessionParams {
    user: User | null;
    initialSessionId?: string | null;
    currentSessionId: string | null;
    setCurrentSessionId: (id: string | null) => void;
    messagesLength: number;
    setMessages: (update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
    onSessionCreated?: (sessionId: string) => void;
    resumeDismissed: boolean;
    setResumeDismissed: (dismissed: boolean) => void;
}

export function useResumeSession({
    user,
    initialSessionId,
    currentSessionId,
    setCurrentSessionId,
    messagesLength,
    setMessages,
    onSessionCreated,
    resumeDismissed,
    setResumeDismissed,
}: UseResumeSessionParams) {
    const [resumeSession, setResumeSession] = useState<{ sessionId: string; title: string } | null>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        return () => { isMountedRef.current = false; };
    }, []);

    // Reload messages when component mounts if sessionId is set but no messages exist
    useEffect(() => {
        if (initialSessionId && messagesLength === 0 && user) {
            loadChatHistory(initialSessionId)
                .then((history) => {
                    if (isMountedRef.current && history.length > 0) {
                        setMessages(history);
                    }
                })
                .catch((err) => {
                    if (__DEV__) console.error('Failed to reload chat history:', err);
                });
        }
    // Only run on mount with initialSessionId
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialSessionId, user]);

    // Check for resumable session on mount
    useEffect(() => {
        if (initialSessionId || messagesLength > 0 || resumeDismissed) return;

        getLastSessionWithMessages().then((result) => {
            if (!isMountedRef.current) return;
            if (!result) return;

            const hoursSince = (Date.now() - result.lastMessageAt.getTime()) / (1000 * 60 * 60);
            if (hoursSince < 24 && result.title.trim().length > 0) {
                setResumeSession({ sessionId: result.sessionId, title: result.title });
            }
        }).catch(() => {
            // Silently fail - resume is non-critical
        });
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleResumeContinue = useCallback(async () => {
        if (!resumeSession) return;
        try {
            const history = await loadChatHistory(resumeSession.sessionId);
            setMessages(history);
            setCurrentSessionId(resumeSession.sessionId);
            onSessionCreated?.(resumeSession.sessionId);
            setResumeSession(null);
        } catch (err) {
            if (__DEV__) console.error('Failed to resume session:', err);
        }
    }, [onSessionCreated, resumeSession, setMessages, setCurrentSessionId]);

    const handleResumeDismiss = useCallback(() => {
        setResumeSession(null);
        setResumeDismissed(true);
    }, [setResumeDismissed]);

    return {
        resumeSession,
        setResumeSession,
        handleResumeContinue,
        handleResumeDismiss,
    };
}
