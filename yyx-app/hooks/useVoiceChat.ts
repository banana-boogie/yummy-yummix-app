/**
 * useVoiceChat Hook
 *
 * Manages voice chat state and interactions with OpenAI Realtime provider.
 * Accumulates a live transcript and handles tool calls (recipe search/generation)
 * by bridging between the frontend WebRTC data channel and backend edge functions.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMeasurement } from '@/contexts/MeasurementContext';
import { useVoiceSession } from '@/contexts/VoiceSessionContext';
import { VoiceProviderFactory } from '@/services/voice/VoiceProviderFactory';
import type {
    VoiceAssistantProvider,
    VoiceStatus,
    VoiceToolCall,
    RecipeContext,
    QuotaInfo,
} from '@/services/voice/types';
import type { ChatMessage } from '@/services/chatService';

interface UseVoiceChatOptions {
    recipeContext?: RecipeContext;
    onQuotaWarning?: (quota: QuotaInfo) => void;
    /** Chat session ID — enables conversation history for context-aware tool calls */
    sessionId?: string | null;
    /** External transcript messages (for mode-switch persistence) */
    initialTranscriptMessages?: ChatMessage[];
    onTranscriptChange?: (messages: ChatMessage[]) => void;
}

let _msgCounter = 0;
function generateMsgId(): string {
    return `voice-msg-${Date.now()}-${++_msgCounter}`;
}

export function useVoiceChat(options?: UseVoiceChatOptions) {
    const [status, setStatus] = useState<VoiceStatus>('idle');
    const [transcript, setTranscript] = useState('');
    const [response, setResponse] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);
    const [isExecutingTool, setIsExecutingTool] = useState(false);

    // Transcript messages for the live transcript UI
    const [transcriptMessages, setTranscriptMessages] = useState<ChatMessage[]>(
        options?.initialTranscriptMessages || []
    );

    // Ref to accumulate streaming assistant text
    const assistantTextRef = useRef('');
    // Ref to hold recipe data from tool execution, attached to next assistant message
    const pendingRecipeDataRef = useRef<{
        recipes?: ChatMessage['recipes'];
        customRecipe?: ChatMessage['customRecipe'];
        safetyFlags?: ChatMessage['safetyFlags'];
    } | null>(null);
    // Ref to hold the streaming assistant message ID for updates
    const streamingMsgIdRef = useRef<string | null>(null);
    // Ref to remember the most recent assistant message (for ordering correction)
    const lastAssistantMsgIdRef = useRef<string | null>(null);
    // Ref to track the active response ID and ignore late events from interrupted responses
    const activeResponseIdRef = useRef<string | null>(null);

    // Delta batching — coalesce rapid assistantTranscriptDelta events
    const DELTA_BATCH_MS = 80;
    const deltaBufferRef = useRef('');
    const deltaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Listener tracking for proper cleanup via .off()
    const listenersRef = useRef<Array<{ event: string; callback: (...args: any[]) => void }>>([]);

    const { userProfile } = useUserProfile();
    const { language } = useLanguage();
    const { measurementSystem } = useMeasurement();
    const { registerSession, unregisterSession } = useVoiceSession();

    const providerRef = useRef<VoiceAssistantProvider | null>(null);
    const hookIdRef = useRef(generateMsgId());

    const resetStreamingRefs = useCallback((preserveLastAssistant = false) => {
        if (deltaTimerRef.current) {
            clearTimeout(deltaTimerRef.current);
            deltaTimerRef.current = null;
        }
        deltaBufferRef.current = '';
        streamingMsgIdRef.current = null;
        assistantTextRef.current = '';
        pendingRecipeDataRef.current = null;
        activeResponseIdRef.current = null;
        if (!preserveLastAssistant) {
            lastAssistantMsgIdRef.current = null;
        }
    }, []);

    // Sync from parent when external messages are explicitly reset (e.g. "New Chat").
    // Track previous external length to only clear on a >0 → 0 transition,
    // avoiding false resets when external starts as [] during normal flow.
    const externalMessages = options?.initialTranscriptMessages;
    const prevExternalLengthRef = useRef(externalMessages?.length ?? 0);
    useEffect(() => {
        const prevLen = prevExternalLengthRef.current;
        const curLen = externalMessages?.length ?? 0;
        prevExternalLengthRef.current = curLen;

        if (prevLen > 0 && curLen === 0) {
            setTranscriptMessages([]);
        }
    }, [externalMessages]);

    // Notify parent of transcript changes (stabilised via ref to avoid render storms)
    const onTranscriptChangeRef = useRef(options?.onTranscriptChange);
    useEffect(() => { onTranscriptChangeRef.current = options?.onTranscriptChange; });
    useEffect(() => {
        onTranscriptChangeRef.current?.(transcriptMessages);
    }, [transcriptMessages]);

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            resetStreamingRefs();
            // Remove all tracked event listeners
            for (const { event, callback } of listenersRef.current) {
                providerRef.current?.off(event as any, callback);
            }
            listenersRef.current = [];
            providerRef.current?.destroy();
            unregisterSession(hookIdRef.current);
        };
    }, [resetStreamingRefs, unregisterSession]);

    // Helper to append a message to the transcript
    const appendMessage = useCallback((msg: ChatMessage) => {
        setTranscriptMessages(prev => [...prev, msg]);
    }, []);

    // Helper to update a specific message by ID (e.g. to write back savedRecipeId)
    const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
        setTranscriptMessages(prev => prev.map(msg =>
            msg.id === id ? { ...msg, ...updates } : msg
        ));
    }, []);

    // Helper to update the last assistant message (for streaming)
    const updateStreamingMessage = useCallback((id: string, content: string) => {
        setTranscriptMessages(prev => {
            const idx = prev.findIndex(m => m.id === id);
            if (idx === -1) return prev;
            const updated = [...prev];
            updated[idx] = { ...updated[idx], content };
            return updated;
        });
    }, []);

    // Finalize the streaming assistant message with full text and recipe data
    const finalizeAssistantMessage = useCallback((id: string, fullText: string) => {
        setTranscriptMessages(prev => {
            const idx = prev.findIndex(m => m.id === id);
            if (idx === -1) return prev;
            const updated = [...prev];
            const pending = pendingRecipeDataRef.current;
            const existing = updated[idx];
            const shouldApplyRecipes = !!pending?.recipes && !existing.recipes;
            const shouldApplyCustomRecipe = !!pending?.customRecipe && !existing.customRecipe;
            const shouldApplySafetyFlags = !!pending?.safetyFlags && !existing.safetyFlags;
            updated[idx] = {
                ...existing,
                content: fullText,
                ...(shouldApplyRecipes ? { recipes: pending?.recipes } : {}),
                ...(shouldApplyCustomRecipe ? { customRecipe: pending?.customRecipe } : {}),
                ...(shouldApplySafetyFlags ? { safetyFlags: pending?.safetyFlags } : {}),
            };
            pendingRecipeDataRef.current = null;
            return updated;
        });
        streamingMsgIdRef.current = null;
        assistantTextRef.current = '';
        lastAssistantMsgIdRef.current = id;
    }, []);

    const startConversation = useCallback(async () => {
        setError(null);
        setTranscript('');
        setResponse('');
        resetStreamingRefs();

        try {
            // 1. Check if authenticated
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            // 2. Create OpenAI Realtime provider instance
            providerRef.current = VoiceProviderFactory.create('openai-realtime');

            // Helper: register listener and track for cleanup
            listenersRef.current = [];
            const addListener = (event: string, callback: (...args: any[]) => void) => {
                providerRef.current!.on(event as any, callback);
                listenersRef.current.push({ event, callback });
            };

            // Set up event listeners
            addListener('statusChange', setStatus);
            addListener('transcript', setTranscript);
            addListener('response', (res: any) => {
                const text = res.text || res.transcript || '';
                setResponse(text);
            });
            addListener('error', (err: any) => setError(err.message));

            // Transcript events for live transcript
            addListener('userTranscriptComplete', (text: string) => {
                if (!text.trim()) return;
                const userMsg: ChatMessage = {
                    id: generateMsgId(),
                    role: 'user',
                    content: text,
                    createdAt: new Date(),
                };
                const targetId = streamingMsgIdRef.current || lastAssistantMsgIdRef.current;
                setTranscriptMessages(prev => {
                    if (targetId) {
                        const idx = prev.findIndex(m => m.id === targetId);
                        if (idx !== -1) {
                            const next = [...prev];
                            next.splice(idx, 0, userMsg);
                            return next;
                        }
                    }
                    return [...prev, userMsg];
                });
                lastAssistantMsgIdRef.current = null;
            });

            addListener('assistantTranscriptDelta', (delta: string, responseId?: string) => {
                if (responseId && activeResponseIdRef.current && responseId !== activeResponseIdRef.current) {
                    return;
                }
                if (responseId && !activeResponseIdRef.current) {
                    activeResponseIdRef.current = responseId;
                }

                assistantTextRef.current += delta;
                deltaBufferRef.current += delta;

                // Create the streaming message on first delta (immediate, no batching)
                if (!streamingMsgIdRef.current) {
                    const id = generateMsgId();
                    streamingMsgIdRef.current = id;
                    lastAssistantMsgIdRef.current = id;
                    deltaBufferRef.current = '';
                    appendMessage({
                        id,
                        role: 'assistant',
                        content: assistantTextRef.current,
                        createdAt: new Date(),
                    });
                    return;
                }

                // Batch subsequent deltas to avoid per-character re-renders
                if (!deltaTimerRef.current) {
                    deltaTimerRef.current = setTimeout(() => {
                        deltaTimerRef.current = null;
                        if (streamingMsgIdRef.current) {
                            deltaBufferRef.current = '';
                            updateStreamingMessage(streamingMsgIdRef.current, assistantTextRef.current);
                        }
                    }, DELTA_BATCH_MS);
                }
            });

            addListener('assistantTranscriptComplete', (fullText: string, responseId?: string) => {
                if (responseId && activeResponseIdRef.current && responseId !== activeResponseIdRef.current) {
                    return;
                }

                // Flush any pending delta batch
                if (deltaTimerRef.current) {
                    clearTimeout(deltaTimerRef.current);
                    deltaTimerRef.current = null;
                }
                deltaBufferRef.current = '';

                if (streamingMsgIdRef.current) {
                    finalizeAssistantMessage(streamingMsgIdRef.current, fullText);
                } else if (fullText.trim()) {
                    // No streaming messages were created (shouldn't happen, but be safe)
                    appendMessage({
                        id: (() => {
                            const id = generateMsgId();
                            lastAssistantMsgIdRef.current = id;
                            return id;
                        })(),
                        role: 'assistant',
                        content: fullText,
                        createdAt: new Date(),
                        ...(pendingRecipeDataRef.current?.recipes ? { recipes: pendingRecipeDataRef.current.recipes } : {}),
                        ...(pendingRecipeDataRef.current?.customRecipe ? { customRecipe: pendingRecipeDataRef.current.customRecipe } : {}),
                        ...(pendingRecipeDataRef.current?.safetyFlags ? { safetyFlags: pendingRecipeDataRef.current.safetyFlags } : {}),
                    });
                    pendingRecipeDataRef.current = null;
                    assistantTextRef.current = '';
                }
                activeResponseIdRef.current = null;
            });

            addListener('responseInterrupted', (responseId?: string) => {
                if (responseId && activeResponseIdRef.current && responseId !== activeResponseIdRef.current) {
                    return;
                }

                if (deltaTimerRef.current) {
                    clearTimeout(deltaTimerRef.current);
                    deltaTimerRef.current = null;
                }

                const currentStreamingId = streamingMsgIdRef.current;
                if (currentStreamingId) {
                    if (assistantTextRef.current.trim()) {
                        finalizeAssistantMessage(currentStreamingId, assistantTextRef.current);
                    } else {
                        setTranscriptMessages(prev => prev.filter(m => m.id !== currentStreamingId));
                        streamingMsgIdRef.current = null;
                        assistantTextRef.current = '';
                        lastAssistantMsgIdRef.current = null;
                    }
                }

                deltaBufferRef.current = '';
                pendingRecipeDataRef.current = null;
                activeResponseIdRef.current = null;
            });

            // Tool call handler
            addListener('toolCall', async (toolCall: VoiceToolCall) => {
                setIsExecutingTool(true);
                try {
                    const result = await executeToolOnBackend(
                        session.access_token,
                        toolCall.name,
                        toolCall.arguments,
                        options?.sessionId ?? undefined,
                    );

                    const recipeData = result.customRecipe
                        ? {
                            customRecipe: result.customRecipe as ChatMessage['customRecipe'],
                            safetyFlags: result.safetyFlags as ChatMessage['safetyFlags'],
                        }
                        : result.recipes
                            ? { recipes: result.recipes as ChatMessage['recipes'] }
                            : null;

                    if (recipeData) {
                        const targetMsgId = streamingMsgIdRef.current;
                        if (targetMsgId) {
                            setTranscriptMessages(prev => prev.map(msg =>
                                msg.id === targetMsgId ? { ...msg, ...recipeData } : msg
                            ));
                            pendingRecipeDataRef.current = null;
                        } else {
                            pendingRecipeDataRef.current = recipeData;
                        }
                    }

                    // Send result back to OpenAI so it can speak about it
                    providerRef.current?.sendToolResult(
                        toolCall.callId,
                        JSON.stringify(result),
                    );
                } catch (err) {
                    console.error('[VoiceChat] Tool execution error:', err);
                    const errorMsg = err instanceof Error ? err.message : 'Tool execution failed';
                    // Send error back to OpenAI so it can gracefully inform the user
                    providerRef.current?.sendToolResult(
                        toolCall.callId,
                        JSON.stringify({ error: errorMsg }),
                    );
                } finally {
                    setIsExecutingTool(false);
                }
            });

            const initData = await providerRef.current.initialize({
                language: language?.startsWith('es') ? 'es' : 'en'
            });

            if (initData) {
                const quota: QuotaInfo = {
                    remainingMinutes: parseFloat(initData.remainingMinutes),
                    minutesUsed: parseFloat(initData.minutesUsed),
                    quotaLimit: initData.quotaLimit,
                    warning: initData.warning
                };
                setQuotaInfo(quota);

                if (quota.warning && options?.onQuotaWarning) {
                    options.onQuotaWarning(quota);
                }
            }

            // 3. Build context
            const userContext = {
                language: (language?.startsWith('es') ? 'es' : 'en') as 'es' | 'en',
                measurementSystem: measurementSystem || 'metric',
                dietaryRestrictions: userProfile?.dietaryRestrictions || [],
                dietTypes: userProfile?.dietTypes || []
            };

            // 4. Start conversation
            await providerRef.current.startConversation({
                userContext,
                recipeContext: options?.recipeContext
            });

            registerSession(hookIdRef.current, () => {
                providerRef.current?.stopConversation();
                resetStreamingRefs();
                unregisterSession(hookIdRef.current);
            });

        } catch (err) {
            console.error('[VoiceChat] Start error:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
            unregisterSession(hookIdRef.current);
        }
    }, [language, measurementSystem, userProfile, options, appendMessage, updateStreamingMessage, finalizeAssistantMessage, resetStreamingRefs, registerSession, unregisterSession]);

    const stopConversation = useCallback(() => {
        providerRef.current?.stopConversation();
        resetStreamingRefs();
        unregisterSession(hookIdRef.current);
    }, [resetStreamingRefs, unregisterSession]);

    const updateContext = useCallback((recipeContext: RecipeContext) => {
        if (!providerRef.current) return;

        const userContext = {
            language: (language?.startsWith('es') ? 'es' : 'en') as 'es' | 'en',
            measurementSystem: measurementSystem || 'metric',
            dietaryRestrictions: userProfile?.dietaryRestrictions || [],
            dietTypes: userProfile?.dietTypes || []
        };

        providerRef.current.setContext(userContext, recipeContext);
    }, [language, measurementSystem, userProfile]);

    return {
        status,
        transcript,
        response,
        error,
        quotaInfo,
        transcriptMessages,
        isExecutingTool,
        updateMessage,
        startConversation,
        stopConversation,
        updateContext
    };
}

/**
 * Execute a tool call on the backend via the irmixy-voice-orchestrator edge function.
 */
async function executeToolOnBackend(
    accessToken: string,
    toolName: string,
    toolArgs: Record<string, unknown>,
    sessionId?: string,
): Promise<Record<string, unknown>> {
    const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL}/irmixy-voice-orchestrator`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'execute_tool',
                toolName,
                toolArgs,
                sessionId,
            }),
        },
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Tool execution failed (${response.status})`);
    }

    return response.json();
}
