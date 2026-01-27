/**
 * Chat API Client
 *
 * Handles communication with the AI orchestrator Edge Function.
 * Uses ai-orchestrator for structured responses with recipes, suggestions, etc.
 *
 * SSE = Server-Sent Events: A standard for servers to push data to clients
 * over HTTP. Used here for streaming AI responses token-by-token.
 */

import { supabase } from '@/lib/supabase';
import EventSource from 'react-native-sse';
import type { IrmixyResponse, IrmixyStatus, RecipeCard, SuggestionChip } from '@/types/irmixy';
import i18n from '@/i18n';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: Date;
    // Structured response data (only for assistant messages)
    recipes?: RecipeCard[];
    suggestions?: SuggestionChip[];
}

export interface ChatSession {
    id: string;
    messages: ChatMessage[];
}

// Re-export types for convenience
export type { IrmixyResponse, IrmixyStatus, RecipeCard, SuggestionChip };

// Constants
const MAX_MESSAGE_LENGTH = 2000;
const STREAM_TIMEOUT_MS = 60000; // 60 seconds

// Use ai-orchestrator for structured responses
const FUNCTIONS_BASE_URL =
    process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL ||
    (process.env.EXPO_PUBLIC_SUPABASE_URL
        ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`
        : '');
const AI_ORCHESTRATOR_URL = `${FUNCTIONS_BASE_URL}/ai-orchestrator`;

/**
 * Streaming callbacks for real-time updates
 */
export interface StreamCallbacks {
    onChunk: (content: string) => void;
    onSessionId?: (sessionId: string) => void;
    onStatus?: (status: IrmixyStatus) => void;
    onComplete?: (response: IrmixyResponse) => void;
}

export interface StreamHandle {
    done: Promise<void>;
    cancel: () => void;
}

/**
 * Send a message to the AI orchestrator (non-streaming).
 * Returns the full structured IrmixyResponse.
 */
export async function sendChatMessage(
    message: string,
    sessionId: string | null
): Promise<IrmixyResponse> {
    // Validate message length
    if (message.length > MAX_MESSAGE_LENGTH) {
        throw new Error(i18n.t('chat.error.messageTooLong', { max: MAX_MESSAGE_LENGTH }));
    }

    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new Error('Not authenticated');
    }

    if (!FUNCTIONS_BASE_URL) {
        throw new Error('Functions URL is not configured');
    }

    const response = await fetch(AI_ORCHESTRATOR_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
            message,
            sessionId,
            mode: 'text',
            stream: false,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
}

/**
 * Stream a message to the AI orchestrator using SSE.
 * Uses react-native-sse for proper streaming support in React Native.
 * Provides real-time status updates and content chunks.
 */
export async function streamChatMessage(
    message: string,
    sessionId: string | null,
    onChunk: (content: string) => void,
    onSessionId?: (sessionId: string) => void,
    onStatus?: (status: IrmixyStatus) => void,
    onComplete?: (response: IrmixyResponse) => void,
): Promise<void> {
    const handle = streamChatMessageWithHandle(
        message,
        sessionId,
        onChunk,
        onSessionId,
        onStatus,
        onComplete,
    );
    return handle.done;
}

/**
 * Stream a message to the AI orchestrator using SSE, returning a cancel handle.
 * This helps avoid leaks and setState-after-unmount issues on the caller side.
 */
export function streamChatMessageWithHandle(
    message: string,
    sessionId: string | null,
    onChunk: (content: string) => void,
    onSessionId?: (sessionId: string) => void,
    onStatus?: (status: IrmixyStatus) => void,
    onComplete?: (response: IrmixyResponse) => void,
): StreamHandle {
    let finished = false;
    let es: EventSource | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let resolveDone: () => void = () => {};
    let rejectDone: (error: Error) => void = () => {};

    const done = new Promise<void>((resolve, reject) => {
        resolveDone = resolve;
        rejectDone = reject;
    });

    void (async () => {
        try {
            // Validate message length
            if (message.length > MAX_MESSAGE_LENGTH) {
                throw new Error(i18n.t('chat.error.messageTooLong', { max: MAX_MESSAGE_LENGTH }));
            }

            const { data: { session } } = await supabase.auth.getSession();

            if (finished) return;

            if (!session?.access_token) {
                throw new Error('Not authenticated');
            }

            if (!FUNCTIONS_BASE_URL) {
                throw new Error('Functions URL is not configured');
            }

            console.log('[SSE] Starting stream request to orchestrator...');

            let chunkCount = 0;

            const safeResolve = () => {
                if (finished) return;
                finished = true;
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                resolveDone();
            };

            const safeReject = (error: Error) => {
                if (finished) return;
                finished = true;
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                rejectDone(error);
            };

            // Create EventSource with POST method and body
            es = new EventSource(AI_ORCHESTRATOR_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    message,
                    sessionId,
                    mode: 'text',
                    stream: true,
                }),
                // Disable automatic reconnection - we handle errors ourselves
                pollingInterval: 0,
            });

            if (finished) {
                es.close();
                return;
            }

            // Set timeout to prevent hanging streams
            timeoutId = setTimeout(() => {
                console.error('[SSE] Stream timeout after', STREAM_TIMEOUT_MS, 'ms');
                es?.close();
                safeReject(new Error(i18n.t('chat.error.timeout', { seconds: STREAM_TIMEOUT_MS / 1000 })));
            }, STREAM_TIMEOUT_MS);

            es.addEventListener('open', () => {
                console.log('[SSE] Connection opened');
            });

            es.addEventListener('message', (event: any) => {
                if (!event.data) return;

                try {
                    const json = JSON.parse(event.data);
                    console.log('[SSE] Event type:', json.type);

                    switch (json.type) {
                        case 'session':
                            if (json.sessionId) {
                                onSessionId?.(json.sessionId);
                            }
                            break;

                        case 'status':
                            if (json.status) {
                                onStatus?.(json.status as IrmixyStatus);
                            }
                            break;

                        case 'content':
                            if (json.content) {
                                chunkCount++;
                                onChunk(json.content);
                            }
                            break;

                        case 'done':
                            console.log('[SSE] Stream complete, chunks received:', chunkCount);
                            if (json.response) {
                                onComplete?.(json.response as IrmixyResponse);
                            }
                            es?.close();
                            safeResolve();
                            break;

                        case 'error':
                            console.error('[SSE] Server error:', json.error);
                            es?.close();
                            safeReject(new Error(json.error || 'Unknown streaming error'));
                            break;
                    }
                } catch (e) {
                    console.error('[SSE] Parse error:', e);
                    // Don't reject on parse errors - continue processing
                }
            });

            es.addEventListener('error', (event: any) => {
                console.error('[SSE] Connection error:', event);
                es?.close();
                safeReject(new Error(event.message || 'SSE connection failed'));
            });
        } catch (error) {
            if (finished) return;
            finished = true;
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            const err = error instanceof Error ? error : new Error(String(error));
            rejectDone(err);
        }
    })();

    const cancel = () => {
        if (finished) return;
        finished = true;
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        console.log('[SSE] Stream cancelled by client');
        es?.close();
        resolveDone();
    };

    return { done, cancel };
}

/**
 * Load chat history for a session.
 */
export async function loadChatHistory(sessionId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
        .from('user_chat_messages')
        .select('id, role, content, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: new Date(msg.created_at),
    }));
}

/**
 * Load user's recent chat sessions.
 * Limited to 5 most recent sessions for performance.
 */
export async function loadChatSessions(): Promise<{ id: string; title: string; createdAt: Date }[]> {
    const { data, error } = await supabase
        .from('user_chat_sessions')
        .select('id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) throw error;

    return (data || []).map((session: any) => ({
        id: session.id,
        title: session.title || i18n.t('chat.newChatTitle'),
        createdAt: new Date(session.created_at),
    }));
}
