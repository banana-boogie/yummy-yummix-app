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

// Use ai-orchestrator for structured responses
const AI_ORCHESTRATOR_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-orchestrator`;

/**
 * Streaming callbacks for real-time updates
 */
export interface StreamCallbacks {
    onChunk: (content: string) => void;
    onSessionId?: (sessionId: string) => void;
    onStatus?: (status: IrmixyStatus) => void;
    onComplete?: (response: IrmixyResponse) => void;
}

/**
 * Send a message to the AI orchestrator (non-streaming).
 * Returns the full structured IrmixyResponse.
 */
export async function sendChatMessage(
    message: string,
    sessionId: string | null
): Promise<IrmixyResponse> {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new Error('Not authenticated');
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
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new Error('Not authenticated');
    }

    console.log('[SSE] Starting stream request to orchestrator...');

    return new Promise((resolve, reject) => {
        let chunkCount = 0;

        // Create EventSource with POST method and body
        const es = new EventSource(AI_ORCHESTRATOR_URL, {
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
                        es.close();
                        resolve();
                        break;

                    case 'error':
                        console.error('[SSE] Server error:', json.error);
                        es.close();
                        reject(new Error(json.error || 'Unknown streaming error'));
                        break;
                }
            } catch (e) {
                console.error('[SSE] Parse error:', e);
                // Don't reject on parse errors - continue processing
            }
        });

        es.addEventListener('error', (event: any) => {
            console.error('[SSE] Connection error:', event);
            es.close();
            reject(new Error(event.message || 'SSE connection failed'));
        });
    });
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
