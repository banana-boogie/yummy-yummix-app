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
import type { IrmixyResponse, IrmixyStatus, RecipeCard, SuggestionChip, GeneratedRecipe, SafetyFlags } from '@/types/irmixy';
import i18n from '@/i18n';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: Date;
    // Structured response data (only for assistant messages)
    recipes?: RecipeCard[];
    suggestions?: SuggestionChip[];
    customRecipe?: GeneratedRecipe;
    safetyFlags?: SafetyFlags;
    // Error state flag for styling error messages
    hasError?: boolean;
    // ID of the saved custom recipe (to avoid duplicate saves)
    savedRecipeId?: string;
}

export interface ChatSession {
    id: string;
    messages: ChatMessage[];
}

// Re-export types for convenience
export type { IrmixyResponse, IrmixyStatus, RecipeCard, SuggestionChip, GeneratedRecipe, SafetyFlags };

// Constants
const MAX_MESSAGE_LENGTH = 2000;
const STREAM_TIMEOUT_MS = 60000; // 60 seconds
const MAX_RETRIES = 3;

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
        let retryCount = 0;
        let connectionError: Error | null = null;
        let hasReceivedData = false;

        // Retry loop with exponential backoff
        while (retryCount <= MAX_RETRIES) {
            // Reset for each retry
            connectionError = null;
            hasReceivedData = false;

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

                if (retryCount > 0) {
                    const backoffMs = Math.pow(2, retryCount) * 1000;
                    await new Promise(r => setTimeout(r, backoffMs));
                    if (finished) return;
                }

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

                // Wrap connection in Promise to handle retry logic
                await new Promise<void>((resolveConnection, rejectConnection) => {
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
                        rejectConnection(new Error('Cancelled'));
                        return;
                    }

                    // Set timeout to prevent hanging streams
                    timeoutId = setTimeout(() => {
                        if (__DEV__) console.error('[SSE] Stream timeout after', STREAM_TIMEOUT_MS, 'ms');
                        es?.close();
                        const timeoutError = new Error(i18n.t('chat.error.timeout', { seconds: STREAM_TIMEOUT_MS / 1000 }));
                        safeReject(timeoutError);
                        rejectConnection(timeoutError);
                    }, STREAM_TIMEOUT_MS);

                    es.addEventListener('open', () => {
                        // Connection opened - no logging needed
                    });

                    es.addEventListener('message', (event: any) => {
                        if (!event.data) return;
                        hasReceivedData = true; // Mark that we received data

                        try {
                            const json = JSON.parse(event.data);

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
                                        onChunk(json.content);
                                    }
                                    break;

                                case 'done':
                                    if (json.response) {
                                        onComplete?.(json.response as IrmixyResponse);
                                    }
                                    es?.close();
                                    safeResolve();
                                    resolveConnection();
                                    break;

                                case 'error':
                                    if (__DEV__) console.error('[SSE] Server error:', json.error);
                                    es?.close();
                                    const serverError = new Error(json.error || 'Unknown streaming error');
                                    safeReject(serverError);
                                    rejectConnection(serverError);
                                    break;
                            }
                        } catch (e) {
                            if (__DEV__) console.error('[SSE] Parse error:', e);
                            // Don't reject on parse errors - continue processing
                        }
                    });

                    es.addEventListener('error', (event: any) => {
                        if (__DEV__) console.error('[SSE] Connection error:', event, 'hasReceivedData:', hasReceivedData);
                        es?.close();
                        connectionError = new Error(event.message || 'SSE connection failed');
                        rejectConnection(connectionError);
                    });
                });

                // If we reach here, connection succeeded
                return;

            } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));

                // Only retry on connection errors if no data was received
                if (connectionError && !hasReceivedData && retryCount < MAX_RETRIES) {
                    retryCount++;
                    continue; // Retry the while loop
                }

                // Either max retries exceeded, data was received, or non-connection error
                if (finished) return;
                finished = true;
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                rejectDone(err);
                return;
            }
        }
    })();

    const cancel = () => {
        if (finished) return;
        finished = true;
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        es?.close();
        resolveDone();
    };

    return { done, cancel };
}

/**
 * Load chat history for a session.
 * Includes recipes from tool_calls for assistant messages.
 */
export async function loadChatHistory(sessionId: string): Promise<ChatMessage[]> {
    // Verify user owns this session
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
        throw new Error('Not authenticated');
    }

    // First verify session ownership
    const { data: session, error: sessionError } = await supabase
        .from('user_chat_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', userData.user.id)
        .single();

    if (sessionError || !session) {
        throw new Error('Session not found');
    }

    const { data, error } = await supabase
        .from('user_chat_messages')
        .select('id, role, content, created_at, tool_calls')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map((msg: any) => {
        const message: ChatMessage = {
            id: msg.id,
            role: msg.role,
            content: msg.content,
            createdAt: new Date(msg.created_at),
        };

        // Parse recipes and customRecipe from tool_calls if present (assistant messages)
        if (msg.role === 'assistant' && msg.tool_calls) {
            if (msg.tool_calls.recipes) {
                message.recipes = msg.tool_calls.recipes;
            }
            if (msg.tool_calls.customRecipe) {
                message.customRecipe = msg.tool_calls.customRecipe;
            }
        }

        return message;
    });
}

/**
 * Load user's recent chat sessions.
 * Limited to 5 most recent sessions for performance.
 */
export async function loadChatSessions(): Promise<{ id: string; title: string; createdAt: Date }[]> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
        throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
        .from('user_chat_sessions')
        .select('id, title, created_at')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) throw error;

    return (data || []).map((session: any) => ({
        id: session.id,
        title: session.title || i18n.t('chat.newChatTitle'),
        createdAt: new Date(session.created_at),
    }));
}

/**
 * Get the most recent chat session that has messages.
 * Returns null if no session exists or the last session has no messages.
 */
export async function getLastSessionWithMessages(): Promise<{
    sessionId: string;
    messageCount: number;
    lastMessageAt: Date;
} | null> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
        return null;
    }

    // Get most recent session for this user
    const { data: sessions, error: sessionError } = await supabase
        .from('user_chat_sessions')
        .select('id, created_at')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false })
        .limit(1);

    if (sessionError || !sessions || sessions.length === 0) {
        return null;
    }

    const session = sessions[0];

    // Check if this session has messages
    const { data: messages, error: msgError } = await supabase
        .from('user_chat_messages')
        .select('id, created_at')
        .eq('session_id', session.id)
        .order('created_at', { ascending: false })
        .limit(1);

    if (msgError || !messages || messages.length === 0) {
        return null;
    }

    // Get total message count
    const { count, error: countError } = await supabase
        .from('user_chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', session.id);

    if (countError) {
        return null;
    }

    return {
        sessionId: session.id,
        messageCount: count || 0,
        lastMessageAt: new Date(messages[0].created_at),
    };
}
