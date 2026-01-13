/**
 * Chat API Client
 * 
 * Handles communication with the AI chat Edge Function.
 * 
 * SSE = Server-Sent Events: A standard for servers to push data to clients
 * over HTTP. Used here for streaming AI responses token-by-token.
 */

import { supabase } from '@/lib/supabase';
import i18n from '@/i18n';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: Date;
}

export interface ChatSession {
    id: string;
    messages: ChatMessage[];
}

interface ChatResponse {
    content: string;
    sessionId: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
    };
}

// Use ai/ namespace for all AI-related functions
const AI_CHAT_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-chat`;

/**
 * Send a message to the chat API.
 * 
 * @param message - The user's message
 * @param sessionId - Optional session ID to continue a conversation
 * @returns ChatResponse with the assistant's reply
 */
export async function sendChatMessage(
    message: string,
    sessionId: string | null
): Promise<ChatResponse> {
    // Get current session token
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new Error('Not authenticated');
    }

    // Get current language from i18n
    const language = i18n.locale.startsWith('es') ? 'es' : 'en';

    const response = await fetch(AI_CHAT_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
            message,
            sessionId,
            language,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
}

/**
 * Stream a message to the chat API using SSE.
 * 
 * @param message - The user's message
 * @param sessionId - Optional session ID to continue a conversation
 * @param onChunk - Callback for each content chunk
 * @param onSessionId - Callback when session ID is received
 * @returns Promise that resolves when streaming completes
 */
export async function streamChatMessage(
    message: string,
    sessionId: string | null,
    onChunk: (content: string) => void,
    onSessionId?: (sessionId: string) => void,
): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new Error('Not authenticated');
    }

    const language = i18n.locale.startsWith('es') ? 'es' : 'en';

    const response = await fetch(AI_CHAT_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
            message,
            sessionId,
            language,
            stream: true,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            try {
                const json = JSON.parse(trimmed.slice(6));

                if (json.type === 'session' && json.sessionId) {
                    onSessionId?.(json.sessionId);
                } else if (json.type === 'content' && json.content) {
                    onChunk(json.content);
                } else if (json.type === 'error') {
                    throw new Error(json.error);
                }
                // 'done' type is handled by loop ending
            } catch (e) {
                // Skip malformed JSON, but re-throw errors
                if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
                    throw e;
                }
            }
        }
    }
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
        title: session.title || 'New Chat',
        createdAt: new Date(session.created_at),
    }));
}
