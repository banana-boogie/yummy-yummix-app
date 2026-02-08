/**
 * Chat API Client
 *
 * Handles communication with the Irmixy chat orchestrator Edge Function.
 * Uses irmixy-chat-orchestrator for structured responses with recipes, suggestions, etc.
 *
 * SSE = Server-Sent Events: A standard for servers to push data to clients
 * over HTTP. Used here for streaming AI responses token-by-token.
 */

import { supabase } from '@/lib/supabase';
import EventSource from 'react-native-sse';
import type { IrmixyResponse, IrmixyStatus, RecipeCard, SuggestionChip, GeneratedRecipe, SafetyFlags, QuickAction } from '@/types/irmixy';
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
    actions?: QuickAction[];
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
export type { IrmixyResponse, IrmixyStatus, RecipeCard, SuggestionChip, GeneratedRecipe, SafetyFlags, QuickAction };

// Constants
const MAX_MESSAGE_LENGTH = 2000;
const STREAM_TIMEOUT_MS = 60000; // 60 seconds
const MAX_RETRIES = 3;

// Use irmixy-chat-orchestrator for structured responses
const FUNCTIONS_BASE_URL =
    process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL ||
    (process.env.EXPO_PUBLIC_SUPABASE_URL
        ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`
        : '');
const IRMIXY_CHAT_ORCHESTRATOR_URL = `${FUNCTIONS_BASE_URL}/irmixy-chat-orchestrator`;

/**
 * Streaming callbacks for real-time updates
 */
export interface StreamCallbacks {
    onChunk: (content: string) => void;
    onSessionId?: (sessionId: string) => void;
    onStatus?: (status: IrmixyStatus) => void;
    onStreamComplete?: () => void;  // Called when text streaming finishes (before suggestions)
    onPartialRecipe?: (recipe: GeneratedRecipe) => void;  // Called with partial recipe before enrichment
    onComplete?: (response: IrmixyResponse) => void;
}

export interface StreamHandle {
    done: Promise<void>;
    cancel: () => void;
}

export type SSERouteAction = 'continue' | 'resolve' | 'reject';

export interface SSERouteResult {
    action: SSERouteAction;
    error?: Error;
}

/**
 * Build callback object for the simplified stream wrapper.
 * Keeps callback-slot mapping explicit and testable.
 */
export function createSimpleStreamCallbacks(
    onChunk: (content: string) => void,
    onSessionId?: (sessionId: string) => void,
    onStatus?: (status: IrmixyStatus) => void,
    onComplete?: (response: IrmixyResponse) => void,
): StreamCallbacks {
    return {
        onChunk,
        onSessionId,
        onStatus,
        onComplete,
    };
}

/**
 * Route a parsed SSE payload to callbacks and indicate stream lifecycle action.
 */
export function routeSSEMessage(
    payload: unknown,
    callbacks: StreamCallbacks,
): SSERouteResult {
    if (!payload || typeof payload !== 'object') {
        return { action: 'continue' };
    }

    const data = payload as Record<string, unknown>;

    switch (data.type) {
        case 'session':
            if (typeof data.sessionId === 'string') {
                callbacks.onSessionId?.(data.sessionId);
            }
            return { action: 'continue' };

        case 'status':
            if (typeof data.status === 'string') {
                callbacks.onStatus?.(data.status as IrmixyStatus);
            }
            return { action: 'continue' };

        case 'content':
            if (typeof data.content === 'string') {
                callbacks.onChunk(data.content);
            }
            return { action: 'continue' };

        case 'stream_complete':
            callbacks.onStreamComplete?.();
            return { action: 'continue' };

        case 'recipe_partial':
            if (__DEV__) {
                console.log('[SSE] recipe_partial event received:', {
                    hasRecipe: !!data.recipe,
                    recipeName: (data.recipe as any)?.suggestedName,
                });
            }
            if (data.recipe) {
                callbacks.onPartialRecipe?.(data.recipe as GeneratedRecipe);
            }
            return { action: 'continue' };

        case 'done':
            if (__DEV__) {
                console.log('[SSE] done event received:', {
                    hasResponse: !!data.response,
                    responseKeys: data.response ? Object.keys(data.response as object) : [],
                    hasCustomRecipe: !!(data.response as any)?.customRecipe,
                    customRecipeName: (data.response as any)?.customRecipe?.suggestedName,
                });
            }
            if (data.response) {
                callbacks.onComplete?.(data.response as IrmixyResponse);
            }
            return { action: 'resolve' };

        case 'error':
            return {
                action: 'reject',
                error: new Error(
                    typeof data.error === 'string' && data.error.length > 0
                        ? data.error
                        : 'Unknown streaming error'
                ),
            };

        default:
            return { action: 'continue' };
    }
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

    const response = await fetch(IRMIXY_CHAT_ORCHESTRATOR_URL, {
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
    const callbacks = createSimpleStreamCallbacks(
        onChunk,
        onSessionId,
        onStatus,
        onComplete,
    );

    const handle = streamChatMessageWithHandle(
        message,
        sessionId,
        callbacks.onChunk,
        callbacks.onSessionId,
        callbacks.onStatus,
        callbacks.onStreamComplete, // Always undefined in simplified wrapper
        callbacks.onPartialRecipe,  // Always undefined in simplified wrapper
        callbacks.onComplete,
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
    onStreamComplete?: () => void,
    onPartialRecipe?: (recipe: GeneratedRecipe) => void,
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
                    es = new EventSource(IRMIXY_CHAT_ORCHESTRATOR_URL, {
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

                            // Debug: log important SSE events
                            if (__DEV__ && (json.type === 'done' || json.type === 'recipe_partial')) {
                                console.log('[SSE] Raw message:', JSON.stringify(json).substring(0, 500));
                            }

                            const routeResult = routeSSEMessage(json, {
                                onChunk,
                                onSessionId,
                                onStatus,
                                onStreamComplete,
                                onPartialRecipe,
                                onComplete,
                            });

                            if (routeResult.action === 'resolve') {
                                es?.close();
                                safeResolve();
                                resolveConnection();
                                return;
                            }

                            if (routeResult.action === 'reject') {
                                if (__DEV__) console.error('[SSE] Server error:', routeResult.error);
                                es?.close();
                                const serverError = routeResult.error || new Error('Unknown streaming error');
                                safeReject(serverError);
                                rejectConnection(serverError);
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
        let toolCalls: any = msg.tool_calls;
        if (typeof toolCalls === 'string') {
            try {
                toolCalls = JSON.parse(toolCalls);
            } catch {
                toolCalls = null;
            }
        }
        const message: ChatMessage = {
            id: msg.id,
            role: msg.role,
            content: msg.content,
            createdAt: new Date(msg.created_at),
        };

        // Parse recipes and customRecipe from tool_calls if present (assistant messages)
        if (msg.role === 'assistant' && toolCalls) {
            if (toolCalls.recipes) {
                message.recipes = toolCalls.recipes;
            }
            if (toolCalls.customRecipe) {
                message.customRecipe = toolCalls.customRecipe;
            }
            if (toolCalls.safetyFlags) {
                message.safetyFlags = toolCalls.safetyFlags;
            }
            if (toolCalls.suggestions) {
                message.suggestions = toolCalls.suggestions;
            }
            if (toolCalls.actions) {
                message.actions = toolCalls.actions;
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
