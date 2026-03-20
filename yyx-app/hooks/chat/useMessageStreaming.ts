import { useState, useCallback, useRef, useEffect } from 'react';
import type { FlatList } from 'react-native';
import type { User } from '@supabase/supabase-js';
import {
    ChatMessage,
    IrmixyStatus,
    BudgetWarningPayload,
    sendMessage,
    BudgetExceededError,
    isRecipeToolStatus,
} from '@/services/chatService';
import type { CookingContext } from '@/types/irmixy';
import i18n from '@/i18n';

const CHUNK_BATCH_MS = 50;
const SCROLL_DELAY_MS = 100;
const LOADING_TIMEOUT_MS = 60_000; // Force-reset isLoading after 60s (hung SSE recovery)

interface UseMessageStreamingParams {
    user: User | null;
    messages: ChatMessage[];
    setMessages: (update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
    messagesRef: React.MutableRefObject<ChatMessage[]>;
    currentSessionId: string | null;
    setCurrentSessionId: (id: string | null) => void;
    onSessionCreated?: (sessionId: string) => void;
    stopAndGuard: () => void;
    scrollToEndThrottled: (animated: boolean) => void;
    isNearBottomRef: React.MutableRefObject<boolean>;
    skipNextScrollToEndRef: React.MutableRefObject<boolean>;
    hasRecipeInCurrentStreamRef: React.MutableRefObject<boolean>;
    flatListRef: React.RefObject<FlatList>;
    onResumeSessionClear: () => void;
    onBudgetWarning?: (warning: BudgetWarningPayload) => void;
    onBudgetExceeded?: (error: BudgetExceededError) => void;
    /** Structured cooking context — sent as a separate field in the request body */
    cookingContext?: CookingContext;
    onActionsReceived?: (actions: import('@/types/irmixy').Action[], response: import('@/types/irmixy').IrmixyResponse) => void;
}

export function useMessageStreaming({
    user,
    messages,
    setMessages,
    messagesRef,
    currentSessionId,
    setCurrentSessionId,
    onSessionCreated,
    stopAndGuard,
    scrollToEndThrottled,
    isNearBottomRef,
    skipNextScrollToEndRef,
    hasRecipeInCurrentStreamRef,
    flatListRef,
    onResumeSessionClear,
    onBudgetWarning,
    onBudgetExceeded,
    cookingContext,
    onActionsReceived,
}: UseMessageStreamingParams) {
    const isMountedRef = useRef(true);
    const streamCancelRef = useRef<(() => void) | null>(null);
    const streamRequestIdRef = useRef(0);
    const assistantIndexRef = useRef<number | null>(null);
    const chunkBufferRef = useRef<string>('');
    const chunkTimerRef = useRef<NodeJS.Timeout | null>(null);

    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isRecipeGenerating, setIsRecipeGenerating] = useState(false);
    const [currentStatus, setCurrentStatus] = useState<IrmixyStatus>(null);

    const resetStreamingState = useCallback(() => {
        streamCancelRef.current?.();
        streamCancelRef.current = null;
        if (chunkTimerRef.current) {
            clearTimeout(chunkTimerRef.current);
            chunkTimerRef.current = null;
        }
        chunkBufferRef.current = '';
        assistantIndexRef.current = null;
        streamRequestIdRef.current += 1;
        setIsLoading(false);
        setIsStreaming(false);
        setIsRecipeGenerating(false);
        setCurrentStatus(null);
    }, []);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            streamCancelRef.current?.();
            streamCancelRef.current = null;
            if (chunkTimerRef.current) {
                clearTimeout(chunkTimerRef.current);
                chunkTimerRef.current = null;
            }
        };
    }, []);

    // Safety net: force-reset loading state if SSE connection hangs
    useEffect(() => {
        if (!isLoading) return;
        const timeoutId = setTimeout(() => {
            if (__DEV__) console.warn('[Chat] Loading timeout — force-resetting after 60s');
            resetStreamingState();
        }, LOADING_TIMEOUT_MS);
        return () => clearTimeout(timeoutId);
    }, [isLoading, resetStreamingState]);

    /**
     * Helper to find and update the assistant message by ID.
     * Centralizes the repeated findIndex pattern.
     */
    const updateAssistantMessage = useCallback((
        assistantMessageId: string,
        updater: (msg: ChatMessage) => ChatMessage,
    ) => {
        setMessages(prev => {
            const updated = [...prev];
            let assistantIdx = assistantIndexRef.current;
            if (
                assistantIdx === null ||
                updated[assistantIdx]?.id !== assistantMessageId
            ) {
                assistantIdx = updated.findIndex(m => m.id === assistantMessageId);
                assistantIndexRef.current = assistantIdx !== -1 ? assistantIdx : null;
            }
            if (assistantIdx !== null && assistantIdx !== -1) {
                updated[assistantIdx] = updater(updated[assistantIdx]);
            }
            return updated;
        });
    }, [setMessages]);

    const handleSendMessage = useCallback(async (messageText: string) => {
        if (!messageText.trim() || !user || isLoading) return;

        onResumeSessionClear();

        streamRequestIdRef.current += 1;
        const requestId = streamRequestIdRef.current;
        const isActiveRequest = () =>
            isMountedRef.current && streamRequestIdRef.current === requestId;

        stopAndGuard();

        const trimmedMessage = messageText.trim();
        const userMessage: ChatMessage = {
            id: `temp-${Date.now()}`,
            role: 'user',
            content: trimmedMessage,
            createdAt: new Date(),
        };

        const assistantMessageId = `assistant-${Date.now()}`;

        setMessages(prev => {
            const assistantMessage: ChatMessage = {
                id: assistantMessageId,
                role: 'assistant',
                content: '',
                createdAt: new Date(),
            };
            const nextMessages = [...prev, userMessage, assistantMessage];
            assistantIndexRef.current = nextMessages.length - 1;
            return nextMessages;
        });
        setInputText('');
        setIsLoading(true);
        setIsStreaming(false);
        setCurrentStatus('thinking');

        isNearBottomRef.current = true;
        hasRecipeInCurrentStreamRef.current = false;

        chunkBufferRef.current = '';
        if (chunkTimerRef.current) {
            clearTimeout(chunkTimerRef.current);
            chunkTimerRef.current = null;
        }

        let completedSuccessfully = false;

        const flushChunkBuffer = () => {
            if (!chunkBufferRef.current || !isActiveRequest()) return;

            const bufferedContent = chunkBufferRef.current;
            chunkBufferRef.current = '';

            updateAssistantMessage(assistantMessageId, (msg) => ({
                ...msg,
                content: msg.content + bufferedContent,
            }));
            if (!hasRecipeInCurrentStreamRef.current) {
                scrollToEndThrottled(false);
            }
        };

        try {
            const handle = sendMessage(
                userMessage.content,
                currentSessionId,
                // onChunk — positional arg 3
                (chunk) => {
                    if (!isActiveRequest()) return;
                    setIsStreaming(true);
                    chunkBufferRef.current += chunk;
                    if (!chunkTimerRef.current) {
                        chunkTimerRef.current = setTimeout(() => {
                            chunkTimerRef.current = null;
                            flushChunkBuffer();
                        }, CHUNK_BATCH_MS);
                    }
                },
                // onSessionId
                (sessionId) => {
                    if (!isActiveRequest()) return;
                    if (!currentSessionId) {
                        setCurrentSessionId(sessionId);
                        onSessionCreated?.(sessionId);
                    }
                },
                // onStatus
                (status) => {
                    if (!isActiveRequest()) return;
                    setCurrentStatus(status);
                    if (isRecipeToolStatus(status)) {
                        setIsRecipeGenerating(true);
                    }
                },
                // onStreamComplete
                () => {
                    if (!isActiveRequest()) return;
                    setIsLoading(false);
                    setIsStreaming(false);
                },
                // onPartialRecipe
                (partialRecipe) => {
                    if (!isActiveRequest()) return;

                    hasRecipeInCurrentStreamRef.current = true;

                    updateAssistantMessage(assistantMessageId, (msg) => ({
                        ...msg,
                        customRecipe: partialRecipe,
                    }));

                    if (assistantIndexRef.current !== null) {
                        const scrollToIdx = assistantIndexRef.current;
                        setTimeout(() => {
                            flatListRef.current?.scrollToIndex({
                                index: scrollToIdx,
                                viewPosition: 0,
                                animated: true,
                            });
                        }, SCROLL_DELAY_MS);
                    }
                },
                // onComplete
                (response) => {
                    if (!isActiveRequest()) return;

                    if (chunkTimerRef.current) {
                        clearTimeout(chunkTimerRef.current);
                        chunkTimerRef.current = null;
                    }

                    const bufferedContent = chunkBufferRef.current;
                    chunkBufferRef.current = '';

                    const hasRecipeData =
                        (response.recipes && response.recipes.length > 0) || response.customRecipe;

                    updateAssistantMessage(assistantMessageId, (msg) => {
                        let finalContent = msg.content;

                        if (bufferedContent) {
                            finalContent += bufferedContent;
                        }
                        if (!finalContent && response.message) {
                            finalContent = response.message;
                        }
                        if (response.customRecipe && response.message) {
                            finalContent = response.message;
                        }

                        return {
                            ...msg,
                            content: finalContent,
                            recipes: hasRecipeData ? response.recipes : msg.recipes,
                            customRecipe: hasRecipeData ? response.customRecipe : msg.customRecipe,
                            safetyFlags: hasRecipeData ? response.safetyFlags : msg.safetyFlags,
                            actions: response.actions,
                            suggestions: response.suggestions,
                        };
                    });

                    // Auto-execute actions (e.g., share_recipe triggered by AI)
                    if (response.actions?.length && onActionsReceived) {
                        onActionsReceived(response.actions, response);
                    }

                    if (hasRecipeData && assistantIndexRef.current !== null) {
                        const scrollToIdx = assistantIndexRef.current;
                        skipNextScrollToEndRef.current = true;
                        setTimeout(() => {
                            flatListRef.current?.scrollToIndex({
                                index: scrollToIdx,
                                viewPosition: 0,
                                animated: true,
                            });
                        }, SCROLL_DELAY_MS);
                    }

                    setIsLoading(false);
                    setIsStreaming(false);
                    setIsRecipeGenerating(false);
                    setCurrentStatus(null);
                    hasRecipeInCurrentStreamRef.current = false;
                    completedSuccessfully = true;
                },
                cookingContext ? { cookingContext } : undefined, // options
                onBudgetWarning,
            );

            streamCancelRef.current = () => {
                if (chunkTimerRef.current) {
                    clearTimeout(chunkTimerRef.current);
                    chunkTimerRef.current = null;
                }
                flushChunkBuffer();
                handle.cancel();
            };
            await handle.done;

            if (!isActiveRequest()) return;

            if (chunkTimerRef.current) {
                clearTimeout(chunkTimerRef.current);
                chunkTimerRef.current = null;
            }
            flushChunkBuffer();
        } catch (error) {
            if (!isActiveRequest()) return;

            if (chunkTimerRef.current) {
                clearTimeout(chunkTimerRef.current);
                chunkTimerRef.current = null;
            }
            flushChunkBuffer();

            // Handle budget exceeded — notify parent, don't show as generic error
            if (error instanceof BudgetExceededError) {
                onBudgetExceeded?.(error);
                // Remove both optimistic messages in one atomic update.
                setMessages(prev =>
                    prev.filter(m => m.id !== assistantMessageId && m.id !== userMessage.id),
                );
                return;
            }

            const getErrorMessage = () => {
                if (error instanceof TypeError && error.message.includes('fetch')) {
                    return i18n.t('chat.error.networkError');
                }
                if (error instanceof Error && error.message.includes('recipe')) {
                    return i18n.t('chat.error.recipeGeneration');
                }
                return i18n.t('chat.error.default');
            };

            if (isActiveRequest()) {
                const errorMessage = getErrorMessage();

                updateAssistantMessage(assistantMessageId, (msg) => {
                    const existingContent = msg.content;
                    return {
                        ...msg,
                        content: existingContent
                            ? `${existingContent}\n\n⚠️ ${errorMessage}`
                            : `⚠️ ${errorMessage}`,
                        hasError: true,
                    };
                });

                if (__DEV__) console.error('Chat error:', error);
            }
        } finally {
            if (isActiveRequest() && !completedSuccessfully) {
                setIsLoading(false);
                setIsStreaming(false);
                setIsRecipeGenerating(false);
                setCurrentStatus(null);
            }
            streamCancelRef.current = null;
        }
    }, [
        cookingContext,
        currentSessionId,
        isLoading,
        onSessionCreated,
        onResumeSessionClear,
        onBudgetWarning,
        onBudgetExceeded,
        scrollToEndThrottled,
        setMessages,
        setCurrentSessionId,
        stopAndGuard,
        updateAssistantMessage,
        user,
        onActionsReceived,
        flatListRef,
        hasRecipeInCurrentStreamRef,
        isNearBottomRef,
        skipNextScrollToEndRef,
    ]);

    const handleSend = useCallback(() => {
        handleSendMessage(inputText);
    }, [inputText, handleSendMessage]);

    return {
        inputText,
        setInputText,
        isLoading,
        isStreaming,
        isRecipeGenerating,
        currentStatus,
        handleSend,
        handleSendMessage,
        resetStreamingState,
    };
}
