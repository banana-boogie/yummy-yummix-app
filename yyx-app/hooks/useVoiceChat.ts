/**
 * useVoiceChat Hook
 *
 * Manages a real-time voice conversation with Irmixy via WebRTC.
 *
 * ## What this hook does
 *
 * 1. **Session lifecycle** — connects/disconnects the WebRTC voice provider
 * 2. **Live transcript** — builds an ordered list of ChatMessages from streaming
 *    events (user speech via Whisper + assistant audio transcript deltas)
 * 3. **Message ordering** — inserts user messages *before* the assistant response
 *    they triggered, since Whisper transcription often arrives after the AI
 *    has already started speaking
 * 4. **Tool execution** — bridges tool calls (recipe search, generation) from
 *    the voice data channel to the backend edge function, then sends results back
 * 5. **Transcript persistence** — saves the conversation on stop via chatService
 *
 * ## Why refs instead of state for streaming internals
 *
 * Streaming events fire at ~10-50 Hz. Using refs for intermediate accumulation
 * (assistantTextRef, deltaBufferRef) avoids per-character re-renders. State is
 * only updated in batches (every DELTA_BATCH_MS) or on finalization.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import logger from '@/services/logger';
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
import { saveVoiceTranscript } from '@/services/chatService';
import type { Action } from '@/types/irmixy';
import {
    executeAction,
    resolveActionContext,
    type ActionContextSource,
} from '@/services/actions/actionRegistry';

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
    const [executingToolName, setExecutingToolName] = useState<string | null>(null);

    // Transcript messages for the live transcript UI
    const [transcriptMessages, setTranscriptMessages] = useState<ChatMessage[]>(
        options?.initialTranscriptMessages || []
    );

    // Ref mirror of transcriptMessages for use in callbacks (avoids stale closures)
    const transcriptMessagesRef = useRef<ChatMessage[]>(transcriptMessages);
    // Guard against duplicate saves + track what was already saved
    const savingRef = useRef(false);
    const savedMessageCountRef = useRef(0);

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

    /** Check if a response event is from a stale (interrupted/replaced) response. */
    const isStaleResponse = (responseId?: string) =>
        !!(responseId && activeResponseIdRef.current && responseId !== activeResponseIdRef.current);

    /** Build a new assistant ChatMessage, attaching any pending recipe data. */
    const buildAssistantMessage = (content: string): ChatMessage => {
        const pending = pendingRecipeDataRef.current;
        return {
            id: generateMsgId(),
            role: 'assistant' as const,
            content,
            createdAt: new Date(),
            ...(pending?.recipes ? { recipes: pending.recipes } : {}),
            ...(pending?.customRecipe ? { customRecipe: pending.customRecipe } : {}),
            ...(pending?.safetyFlags ? { safetyFlags: pending.safetyFlags } : {}),
        };
    };

    // Listener tracking for proper cleanup via .off()
    const listenersRef = useRef<{ event: string; callback: (...args: any[]) => void }[]>([]);

    const { userProfile } = useUserProfile();
    const { locale } = useLanguage();
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

    // Sync transcript state from parent on session switches and explicit resets.
    const sessionId = options?.sessionId ?? null;
    const externalMessages = options?.initialTranscriptMessages;
    const prevSyncRef = useRef<{ sessionId: string | null; externalMessages: ChatMessage[] | undefined }>({
        sessionId,
        externalMessages,
    });
    useEffect(() => {
        const prev = prevSyncRef.current;
        const sessionChanged = prev.sessionId !== sessionId;
        const prevLen = prev.externalMessages?.length ?? 0;
        const curLen = externalMessages?.length ?? 0;

        if (sessionChanged) {
            const syncedMessages = externalMessages ?? [];
            setTranscriptMessages(syncedMessages);
            // Session switches load persisted history; mark it as already saved.
            savedMessageCountRef.current = syncedMessages.length;

            // Reset in-flight streaming refs to avoid leaking partial content between sessions.
            assistantTextRef.current = '';
            pendingRecipeDataRef.current = null;
            streamingMsgIdRef.current = null;
            deltaBufferRef.current = '';
            if (deltaTimerRef.current) {
                clearTimeout(deltaTimerRef.current);
                deltaTimerRef.current = null;
            }
        } else if (prevLen > 0 && curLen === 0) {
            setTranscriptMessages([]);
            savedMessageCountRef.current = 0;
        }

        prevSyncRef.current = { sessionId, externalMessages };
    }, [externalMessages, sessionId]);

    // Keep transcriptMessagesRef in sync for stopConversation closure
    useEffect(() => {
        transcriptMessagesRef.current = transcriptMessages;
    }, [transcriptMessages]);

    // Notify parent of transcript changes (stabilised via ref to avoid render storms)
    const onTranscriptChangeRef = useRef(options?.onTranscriptChange);
    useEffect(() => { onTranscriptChangeRef.current = options?.onTranscriptChange; });

    // Stabilise hook options via refs so startConversation doesn't re-create on every render
    const sessionIdRef = useRef(options?.sessionId);
    useEffect(() => { sessionIdRef.current = options?.sessionId; });
    const recipeContextRef = useRef(options?.recipeContext);
    useEffect(() => { recipeContextRef.current = options?.recipeContext; });
    const onQuotaWarningRef = useRef(options?.onQuotaWarning);
    useEffect(() => { onQuotaWarningRef.current = options?.onQuotaWarning; });
    useEffect(() => {
        onTranscriptChangeRef.current?.(transcriptMessages);
    }, [transcriptMessages]);

    useEffect(() => {
        // Copy ref value for cleanup closure
        const hookId = hookIdRef.current;
        // Cleanup on unmount
        return () => {
            resetStreamingRefs();
            // Remove all tracked event listeners
            for (const { event, callback } of listenersRef.current) {
                providerRef.current?.off(event as any, callback);
            }
            listenersRef.current = [];
            providerRef.current?.destroy();
            unregisterSession(hookId);
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
            return updated;
        });
        pendingRecipeDataRef.current = null;
        streamingMsgIdRef.current = null;
        assistantTextRef.current = '';
        lastAssistantMsgIdRef.current = id;
    }, []);

    const startConversation = useCallback(async () => {
        setError(null);
        setTranscript('');
        setResponse('');
        resetStreamingRefs();
        savedMessageCountRef.current = transcriptMessagesRef.current.length;

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

            // When user starts speaking, reset lastAssistantMsgIdRef so it only
            // tracks the AI response triggered by THIS speech turn.
            addListener('speechStarted', () => {
                lastAssistantMsgIdRef.current = null;
            });

            addListener('userTranscriptComplete', (text: string) => {
                if (!text.trim()) return;
                const userMsg: ChatMessage = {
                    id: generateMsgId(),
                    role: 'user',
                    content: text,
                    createdAt: new Date(),
                };
                // Insert before the AI response triggered by this user speech.
                // streamingMsgIdRef: AI is still streaming its response.
                // lastAssistantMsgIdRef: AI already finished (Whisper was slower than the AI).
                // Both are reset on speechStarted so they only refer to THIS turn's response.
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
                if (isStaleResponse(responseId)) return;
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
                if (isStaleResponse(responseId)) return;

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
                    const msg = buildAssistantMessage(fullText);
                    lastAssistantMsgIdRef.current = msg.id;
                    appendMessage(msg);
                    pendingRecipeDataRef.current = null;
                    assistantTextRef.current = '';
                }
                activeResponseIdRef.current = null;
            });

            addListener('responseInterrupted', (responseId?: string) => {
                if (isStaleResponse(responseId)) return;

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

            // Safety net: responseDone fires on every non-cancelled response.done.
            // Case A: deltas fired but assistantTranscriptComplete didn't → finalize
            // Case B: NO deltas fired at all → create message from response.done transcript
            // Case C: already finalized → no-op
            addListener('responseDone', (responseId?: string, fallbackTranscript?: string) => {
                if (isStaleResponse(responseId)) return;

                // Flush pending delta batch
                if (deltaTimerRef.current) {
                    clearTimeout(deltaTimerRef.current);
                    deltaTimerRef.current = null;
                }
                deltaBufferRef.current = '';

                if (streamingMsgIdRef.current && assistantTextRef.current.trim()) {
                    finalizeAssistantMessage(streamingMsgIdRef.current, assistantTextRef.current);
                } else if (!streamingMsgIdRef.current && fallbackTranscript?.trim()) {
                    const msg = buildAssistantMessage(fallbackTranscript);
                    lastAssistantMsgIdRef.current = msg.id;
                    appendMessage(msg);
                    pendingRecipeDataRef.current = null;
                    assistantTextRef.current = '';
                }

                activeResponseIdRef.current = null;
            });

            // Tool call handler
            addListener('toolCall', async (toolCall: VoiceToolCall) => {
                logger.debug('[VoiceChat] Tool call:', toolCall.name);
                setIsExecutingTool(true);
                setExecutingToolName(toolCall.name);
                try {
                    const result = await executeToolOnBackend(
                        session.access_token,
                        toolCall.name,
                        toolCall.arguments,
                        sessionIdRef.current ?? undefined,
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

                    // Handle app_action results (e.g., share_recipe)
                    if (result.appActionResult && typeof result.appActionResult === 'object') {
                        const actionResult = result.appActionResult as { action: string; params: Record<string, unknown> };
                        const action: Action = {
                            id: `${actionResult.action}_${Date.now()}`,
                            type: actionResult.action as Action['type'],
                            label: actionResult.action, // Placeholder — replaced by i18n in actionRegistry
                            payload: actionResult.params ?? {},
                            autoExecute: true,
                        };

                        // Attach action to the current or last assistant message
                        const targetMsgId = streamingMsgIdRef.current ?? lastAssistantMsgIdRef.current;
                        if (targetMsgId) {
                            setTranscriptMessages(prev => prev.map(msg =>
                                msg.id === targetMsgId
                                    ? { ...msg, actions: [...(msg.actions ?? []), action] }
                                    : msg
                            ));
                        }

                        // Auto-execute: resolve context from current transcript
                        const messages = transcriptMessagesRef.current;
                        const context = resolveActionContext(
                            messages as ActionContextSource[],
                            targetMsgId ?? undefined,
                        );
                        executeAction(action, context, { source: 'auto', path: 'voice' });
                    }

                    // Send result back to OpenAI so it can speak about it
                    providerRef.current?.sendToolResult(
                        toolCall.callId,
                        JSON.stringify(result),
                    );
                } catch (err) {
                    logger.error('[VoiceChat] Tool execution error:', err);
                    const errorMsg = err instanceof Error ? err.message : 'Tool execution failed';
                    // Send error back to OpenAI so it can gracefully inform the user
                    providerRef.current?.sendToolResult(
                        toolCall.callId,
                        JSON.stringify({ error: errorMsg }),
                    );
                } finally {
                    setIsExecutingTool(false);
                    setExecutingToolName(null);
                }
            });

            const initData = await providerRef.current.initialize({
                locale: locale || 'en'
            });

            if (initData) {
                const quota: QuotaInfo = {
                    remainingMinutes: parseFloat(initData.remainingMinutes),
                    minutesUsed: parseFloat(initData.minutesUsed),
                    quotaLimit: initData.quotaLimit,
                    warning: initData.warning
                };
                setQuotaInfo(quota);

                if (quota.warning && onQuotaWarningRef.current) {
                    onQuotaWarningRef.current(quota);
                }
            }

            // 3. Build context
            const userContext = {
                locale: locale || 'en',
                measurementSystem: measurementSystem || 'metric',
                dietaryRestrictions: userProfile?.dietaryRestrictions || [],
                dietTypes: userProfile?.dietTypes || []
            };

            // 4. Start conversation
            await providerRef.current.startConversation({
                userContext,
                recipeContext: recipeContextRef.current
            });

            registerSession(hookIdRef.current, () => {
                providerRef.current?.stopConversation();
                resetStreamingRefs();
                unregisterSession(hookIdRef.current);
            });

        } catch (err) {
            logger.error('[VoiceChat] Start error:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
            unregisterSession(hookIdRef.current);
        }
    }, [locale, measurementSystem, userProfile, appendMessage, updateStreamingMessage, finalizeAssistantMessage, resetStreamingRefs, registerSession, unregisterSession]);

    const stopConversation = useCallback(() => {
        let messagesToSave = transcriptMessagesRef.current;

        // Finalize any in-flight streaming message before resetting refs
        if (streamingMsgIdRef.current && assistantTextRef.current.trim()) {
            const streamingId = streamingMsgIdRef.current;
            const finalText = assistantTextRef.current;
            const pending = pendingRecipeDataRef.current;
            messagesToSave = messagesToSave.map((message) => {
                if (message.id !== streamingId) {
                    return message;
                }

                const shouldApplyRecipes = !!pending?.recipes && !message.recipes;
                const shouldApplyCustomRecipe = !!pending?.customRecipe && !message.customRecipe;
                const shouldApplySafetyFlags = !!pending?.safetyFlags && !message.safetyFlags;

                return {
                    ...message,
                    content: finalText,
                    ...(shouldApplyRecipes ? { recipes: pending?.recipes } : {}),
                    ...(shouldApplyCustomRecipe ? { customRecipe: pending?.customRecipe } : {}),
                    ...(shouldApplySafetyFlags ? { safetyFlags: pending?.safetyFlags } : {}),
                };
            });

            // Keep React state in sync for UI updates.
            finalizeAssistantMessage(streamingId, finalText);
        }

        providerRef.current?.stopConversation();
        resetStreamingRefs();
        unregisterSession(hookIdRef.current);

        // Fire-and-forget save of voice transcript (only unsaved messages)
        const unsavedMessages = messagesToSave.slice(savedMessageCountRef.current);
        if (unsavedMessages.length > 0 && !savingRef.current) {
            savingRef.current = true;
            const countToSave = messagesToSave.length;
            saveVoiceTranscript(unsavedMessages).then((result) => {
                if (result?.sessionId) {
                    savedMessageCountRef.current = countToSave;
                }
            }).finally(() => {
                savingRef.current = false;
            });
        }
    }, [resetStreamingRefs, unregisterSession, finalizeAssistantMessage]);

    return {
        status,
        transcript,
        response,
        error,
        quotaInfo,
        transcriptMessages,
        isExecutingTool,
        executingToolName,
        updateMessage,
        startConversation,
        stopConversation,
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
