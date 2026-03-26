/**
 * Chat API Client
 *
 * Handles communication with the Irmixy chat orchestrator Edge Function.
 * Uses irmixy-chat-orchestrator for structured responses with recipes, etc.
 *
 * SSE = Server-Sent Events: A standard for servers to push data to clients
 * over HTTP. Used here for streaming AI responses token-by-token.
 */

import { supabase } from '@/lib/supabase';
import EventSource from 'react-native-sse';
import type { IrmixyResponse, IrmixyStatus, RecipeCard, GeneratedRecipe, SafetyFlags, Action, Suggestion, CookingContext } from '@/types/irmixy';
import i18n from '@/i18n';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: Date;
    // Structured response data (only for assistant messages)
    recipes?: RecipeCard[];
    customRecipe?: GeneratedRecipe;
    safetyFlags?: SafetyFlags;
    actions?: Action[];
    suggestions?: Suggestion[];
    // Error state flag for styling error messages
    hasError?: boolean;
    // ID of the saved custom recipe (to avoid duplicate saves)
    savedRecipeId?: string;
}

export interface ChatSession {
    id: string;
    messages: ChatMessage[];
}

export interface BudgetWarningPayload {
    usedUsd: number;
    budgetUsd: number;
}

/** Statuses that indicate recipe generation/modification is in progress */
export const isRecipeToolStatus = (status: IrmixyStatus): boolean =>
    status === 'cooking_it_up' || status === 'generating';

// Re-export types for convenience
export type { IrmixyResponse, IrmixyStatus, RecipeCard, GeneratedRecipe, SafetyFlags, Action, Suggestion, CookingContext };

interface ChatMessageRow {
    id: string;
    role: string;
    content: string;
    created_at: string;
    tool_calls: string | Record<string, unknown> | null;
}

interface ChatSessionRow {
    id: string;
    title: string | null;
    created_at: string;
    source: string | null;
}

// Constants
const MAX_MESSAGE_LENGTH = 2000;
const STREAM_TIMEOUT_MS = 60000; // 60 seconds
const MAX_RETRIES = 3;

/** Error thrown when the user's AI budget is exceeded */
export class BudgetExceededError extends Error {
    tier: string;
    usedUsd: number;
    budgetUsd: number;

    constructor(data: { tier?: string; usedUsd?: number; budgetUsd?: number }) {
        super('budget_exceeded');
        this.name = 'BudgetExceededError';
        this.tier = data.tier || 'free';
        this.usedUsd = data.usedUsd || 0;
        this.budgetUsd = data.budgetUsd || 0;
    }
}

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
    onBudgetWarning?: (warning: BudgetWarningPayload) => void;  // Called when budget is approaching limit
}

export interface StreamHandle {
    done: Promise<void>;
    cancel: () => void;
}

export interface SendMessageOptions {
    /** Structured cooking context — backend injects into system prompt */
    cookingContext?: CookingContext;
}

export type SSERouteAction = 'continue' | 'resolve' | 'reject';

export interface SSERouteResult {
    action: SSERouteAction;
    error?: Error;
}

const parseNumericStatus = (value: unknown): number | null => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const parseObjectPayload = (value: unknown): Record<string, unknown> | null => {
    if (value && typeof value === 'object') {
        return value as Record<string, unknown>;
    }

    if (typeof value !== 'string' || !value.trim()) {
        return null;
    }

    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object'
            ? (parsed as Record<string, unknown>)
            : null;
    } catch {
        return null;
    }
};

export function parseBudgetExceededErrorFromSSEEvent(event: unknown): BudgetExceededError | null {
    if (!event || typeof event !== 'object') {
        return null;
    }

    const eventData = event as Record<string, unknown>;
    const statusCode = parseNumericStatus(eventData.status) ?? parseNumericStatus(eventData.xhrStatus);
    if (statusCode !== 429) {
        return null;
    }

    const payloadCandidates = [eventData.data, eventData.message];
    for (const candidate of payloadCandidates) {
        const payload = parseObjectPayload(candidate);
        if (payload?.error === 'budget_exceeded') {
            return new BudgetExceededError({
                tier: typeof payload.tier === 'string' ? payload.tier : undefined,
                usedUsd: Number(payload.usedUsd),
                budgetUsd: Number(payload.budgetUsd),
            });
        }
    }

    return null;
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
            try {
                if (typeof data.sessionId === 'string') {
                    callbacks.onSessionId?.(data.sessionId);
                }
            } catch (e) {
                if (__DEV__) console.error('[SSE] onSessionId callback error:', e);
            }
            return { action: 'continue' };

        case 'status':
            try {
                if (typeof data.status === 'string') {
                    callbacks.onStatus?.(data.status as IrmixyStatus);
                }
            } catch (e) {
                if (__DEV__) console.error('[SSE] onStatus callback error:', e);
            }
            return { action: 'continue' };

        case 'budget_warning':
            try {
                const usedUsd = Number(data.usedUsd);
                const budgetUsd = Number(data.budgetUsd);
                if (Number.isFinite(usedUsd) && Number.isFinite(budgetUsd)) {
                    callbacks.onBudgetWarning?.({ usedUsd, budgetUsd });
                }
            } catch (e) {
                if (__DEV__) console.error('[SSE] onBudgetWarning callback error:', e);
            }
            return { action: 'continue' };

        case 'content':
            try {
                if (typeof data.content === 'string') {
                    callbacks.onChunk(data.content);
                }
            } catch (e) {
                if (__DEV__) console.error('[SSE] onChunk callback error:', e);
            }
            return { action: 'continue' };

        case 'stream_complete':
            try {
                callbacks.onStreamComplete?.();
            } catch (e) {
                if (__DEV__) console.error('[SSE] onStreamComplete callback error:', e);
            }
            return { action: 'continue' };

        case 'recipe_partial':
            try {
                if (data.recipe) {
                    callbacks.onPartialRecipe?.(data.recipe as GeneratedRecipe);
                }
            } catch (e) {
                if (__DEV__) console.error('[SSE] onPartialRecipe callback error:', e);
            }
            return { action: 'continue' };

        case 'done':
            try {
                if (data.response) {
                    callbacks.onComplete?.(data.response as IrmixyResponse);
                }
            } catch (e) {
                if (__DEV__) console.error('[SSE] onComplete callback error:', e);
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
 * Send a message to the AI orchestrator using SSE, returning a cancel handle.
 * All orchestrator communication uses streaming — this is the sole entry point.
 */
export function sendMessage(
    message: string,
    sessionId: string | null,
    onChunk: (content: string) => void,
    onSessionId?: (sessionId: string) => void,
    onStatus?: (status: IrmixyStatus) => void,
    onStreamComplete?: () => void,
    onPartialRecipe?: (recipe: GeneratedRecipe) => void,
    onComplete?: (response: IrmixyResponse) => void,
    options?: SendMessageOptions,
    onBudgetWarning?: (warning: BudgetWarningPayload) => void,
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
        while (retryCount < MAX_RETRIES) {
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
                    const requestBody: Record<string, unknown> = {
                        message,
                        sessionId,
                        ...(options?.cookingContext ? { cookingContext: options.cookingContext } : {}),
                    };

                    // Create EventSource with POST method and body
                    es = new EventSource(IRMIXY_CHAT_ORCHESTRATOR_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`,
                        },
                        body: JSON.stringify(requestBody),
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

                            const routeResult = routeSSEMessage(json, {
                                onChunk,
                                onSessionId,
                                onStatus,
                                onStreamComplete,
                                onPartialRecipe,
                                onComplete,
                                onBudgetWarning,
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
                        es?.close();

                        const budgetError = parseBudgetExceededErrorFromSSEEvent(event);
                        if (budgetError) {
                            safeReject(budgetError);
                            rejectConnection(budgetError);
                            return;
                        }

                        if (__DEV__) console.error('[SSE] Connection error:', event, 'hasReceivedData:', hasReceivedData);
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
        .from('ai_chat_sessions')
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

    return (data || []).map((msg: ChatMessageRow) => {
        let toolCalls: Record<string, unknown> | null = null;
        if (typeof msg.tool_calls === 'string') {
            try {
                toolCalls = JSON.parse(msg.tool_calls);
            } catch {
                toolCalls = null;
            }
        } else {
            toolCalls = msg.tool_calls;
        }
        const message: ChatMessage = {
            id: msg.id,
            role: msg.role as ChatMessage['role'],
            content: msg.content,
            createdAt: new Date(msg.created_at),
        };

        // Parse recipes and customRecipe from tool_calls if present (assistant messages)
        if (msg.role === 'assistant' && toolCalls) {
            if (toolCalls.recipes) {
                message.recipes = toolCalls.recipes as RecipeCard[];
            }
            if (toolCalls.customRecipe) {
                message.customRecipe = toolCalls.customRecipe as GeneratedRecipe;
            }
            if (toolCalls.safetyFlags) {
                message.safetyFlags = toolCalls.safetyFlags as SafetyFlags;
            }
            if (toolCalls.actions) {
                message.actions = toolCalls.actions as Action[];
            }
        }

        return message;
    });
}

/**
 * Load user's recent chat sessions.
 * Limited to 5 most recent sessions for performance.
 */
export async function loadChatSessions(): Promise<
    { id: string; title: string; createdAt: Date; source?: 'text' | 'voice' }[]
> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
        throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
        .from('ai_chat_sessions')
        .select('id, title, created_at, source')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) throw error;

    return (data || []).map((session: ChatSessionRow) => ({
        id: session.id,
        title: session.title || i18n.t('chat.newChatTitle'),
        createdAt: new Date(session.created_at),
        source: session.source as 'text' | 'voice' | undefined,
    }));
}

/**
 * Get the most recent chat session that has messages.
 * Returns null if no session exists or the last session has no messages.
 */
export async function getLastSessionWithMessages(): Promise<{
    sessionId: string;
    title: string;
    messageCount: number;
    lastMessageAt: Date;
} | null> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
        return null;
    }

    // Get most recent session for this user
    const { data: sessions, error: sessionError } = await supabase
        .from('ai_chat_sessions')
        .select('id, title, created_at')
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
        title: session.title || '',
        messageCount: count || 0,
        lastMessageAt: new Date(messages[0].created_at),
    };
}

/**
 * Save voice chat transcript to backend (same tables as text chat).
 * Fire-and-forget — errors are logged but don't surface to user.
 */
export async function saveVoiceTranscript(
    messages: ChatMessage[],
): Promise<{ sessionId: string } | null> {
    try {
        if (messages.length === 0) return null;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return null;

        const serializedMessages = messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            ...(msg.recipes ? { recipes: msg.recipes } : {}),
            ...(msg.customRecipe ? { customRecipe: msg.customRecipe } : {}),
            ...(msg.safetyFlags ? { safetyFlags: msg.safetyFlags } : {}),
            ...(msg.actions ? { actions: msg.actions } : {}),
        }));

        const response = await fetch(
            `${FUNCTIONS_BASE_URL}/irmixy-voice-orchestrator`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'save_transcript',
                    messages: serializedMessages,
                }),
            },
        );

        if (!response.ok) {
            if (__DEV__) console.error('[saveVoiceTranscript] Failed:', response.status);
            return null;
        }

        const data = await response.json();
        return { sessionId: data.sessionId };
    } catch (err) {
        if (__DEV__) console.error('[saveVoiceTranscript] Error:', err);
        return null;
    }
}

export async function getRecentlyCookedRecipes(limit = 5): Promise<{
    recipeId: string;
    recipeName: string;
    cookedAt: Date;
}[]> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
        return [];
    }

    const { data, error } = await supabase
        .from('user_events')
        .select('payload, created_at')
        .eq('user_id', userData.user.id)
        .eq('event_type', 'cook_complete')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error || !data) {
        return [];
    }

    return data.map((event: { payload: Record<string, unknown> | null; created_at: string }) => ({
        recipeId: (event.payload?.recipe_id as string) || '',
        recipeName: (event.payload?.recipe_name as string) || '',
        cookedAt: new Date(event.created_at),
    }));
}
