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
    /** External transcript messages (for mode-switch persistence) */
    initialTranscriptMessages?: ChatMessage[];
    onTranscriptChange?: (messages: ChatMessage[]) => void;
}

let nextMsgId = 1;
function generateMsgId(): string {
    return `voice-msg-${Date.now()}-${nextMsgId++}`;
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

    const { userProfile } = useUserProfile();
    const { language } = useLanguage();
    const { measurementSystem } = useMeasurement();

    const providerRef = useRef<VoiceAssistantProvider | null>(null);

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

    // Notify parent of transcript changes
    useEffect(() => {
        options?.onTranscriptChange?.(transcriptMessages);
    }, [transcriptMessages]);

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            providerRef.current?.destroy();
        };
    }, []);

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
            updated[idx] = {
                ...updated[idx],
                content: fullText,
                ...(pending?.recipes ? { recipes: pending.recipes } : {}),
                ...(pending?.customRecipe ? { customRecipe: pending.customRecipe } : {}),
                ...(pending?.safetyFlags ? { safetyFlags: pending.safetyFlags } : {}),
            };
            pendingRecipeDataRef.current = null;
            return updated;
        });
        streamingMsgIdRef.current = null;
        assistantTextRef.current = '';
    }, []);

    const startConversation = useCallback(async () => {
        setError(null);
        setTranscript('');
        setResponse('');

        try {
            // 1. Check if authenticated
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            // 2. Create OpenAI Realtime provider instance
            providerRef.current = VoiceProviderFactory.create('openai-realtime');

            // Set up event listeners
            providerRef.current.on('statusChange', setStatus);
            providerRef.current.on('transcript', setTranscript);
            providerRef.current.on('response', (res: any) => {
                const text = res.text || res.transcript || '';
                setResponse(text);
            });
            providerRef.current.on('error', (err: any) => setError(err.message));

            // Transcript events for live transcript
            providerRef.current.on('userTranscriptComplete', (text: string) => {
                if (!text.trim()) return;
                appendMessage({
                    id: generateMsgId(),
                    role: 'user',
                    content: text,
                    createdAt: new Date(),
                });
            });

            providerRef.current.on('assistantTranscriptDelta', (delta: string) => {
                assistantTextRef.current += delta;
                if (!streamingMsgIdRef.current) {
                    // Create a new streaming assistant message
                    const id = generateMsgId();
                    streamingMsgIdRef.current = id;
                    appendMessage({
                        id,
                        role: 'assistant',
                        content: assistantTextRef.current,
                        createdAt: new Date(),
                    });
                } else {
                    updateStreamingMessage(streamingMsgIdRef.current, assistantTextRef.current);
                }
            });

            providerRef.current.on('assistantTranscriptComplete', (fullText: string) => {
                if (streamingMsgIdRef.current) {
                    finalizeAssistantMessage(streamingMsgIdRef.current, fullText);
                } else if (fullText.trim()) {
                    // No streaming messages were created (shouldn't happen, but be safe)
                    appendMessage({
                        id: generateMsgId(),
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
            });

            // Tool call handler
            providerRef.current.on('toolCall', async (toolCall: VoiceToolCall) => {
                setIsExecutingTool(true);
                try {
                    const result = await executeToolOnBackend(
                        session.access_token,
                        toolCall.name,
                        toolCall.arguments,
                    );

                    // Store recipe data for the next assistant message
                    if (result.recipes) {
                        pendingRecipeDataRef.current = { recipes: result.recipes };
                    } else if (result.customRecipe) {
                        pendingRecipeDataRef.current = {
                            customRecipe: result.customRecipe,
                            safetyFlags: result.safetyFlags,
                        };
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

        } catch (err) {
            console.error('[VoiceChat] Start error:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
    }, [language, measurementSystem, userProfile, options, appendMessage, updateStreamingMessage, finalizeAssistantMessage]);

    const stopConversation = useCallback(() => {
        providerRef.current?.stopConversation();
    }, []);

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
 * Execute a tool call on the backend via the voice-tool-execute edge function.
 */
async function executeToolOnBackend(
    accessToken: string,
    toolName: string,
    toolArgs: Record<string, unknown>,
): Promise<Record<string, unknown>> {
    const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL}/voice-tool-execute`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ toolName, toolArgs }),
        },
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Tool execution failed (${response.status})`);
    }

    return response.json();
}
