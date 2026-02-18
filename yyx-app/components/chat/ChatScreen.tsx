import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
    View,
    TextInput,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Animated,
} from 'react-native';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/common/Text';
import { IrmixyAvatar } from '@/components/chat/IrmixyAvatar';
import { TypingDots } from '@/components/chat/TypingIndicator';
import { ChatMessageItem } from '@/components/chat/ChatMessageItem';
import {
    ChatMessage,
    IrmixyStatus,
    GeneratedRecipe,
    QuickAction,
    loadChatHistory,
    sendMessage,
} from '@/services/chatService';
import { customRecipeService } from '@/services/customRecipeService';
import { useQueryClient } from '@tanstack/react-query';
import { customRecipeKeys } from '@/hooks/useCustomRecipe';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import i18n from '@/i18n';
import { COLORS, SPACING } from '@/constants/design-tokens';
import {
    getChatCustomCookingGuidePath,
    getChatRecipeDetailPath,
} from '@/utils/navigation/recipeRoutes';

// Constants
const SCROLL_THROTTLE_MS = 100; // Throttle scroll calls to avoid excessive layout calculations
const SCROLL_DELAY_MS = 100; // Allow render to complete before scrolling
const CHUNK_BATCH_MS = 50; // Batch streaming chunks to reduce re-renders
const SCROLL_THRESHOLD = 100; // Distance from bottom to consider "at bottom" (px)
const ICON_SIZE = 20; // Icon size for mic and send buttons
const ALLERGEN_CONFIRMATION_PATTERNS = [
    /\b(?:yes|yeah|yep|ok|okay|go ahead|proceed|continue|do it|make it anyway)\b/i,
    /\b(?:si|sí|dale|adelante|continua|continúa|procede|hazlo)\b/i,
];

interface Props {
    sessionId?: string | null;
    onSessionCreated?: (sessionId: string) => void;
    // Optional: lift messages state to parent to preserve recipes when switching modes
    messages?: ChatMessage[];
    onMessagesChange?: (messages: ChatMessage[]) => void;
}

// Stable keyExtractor to avoid recreation on each render
const keyExtractor = (item: ChatMessage) => item.id;

function shouldBypassAllergenBlock(
    messageText: string,
    history: ChatMessage[]
): boolean {
    const trimmed = messageText.trim();
    if (!trimmed) return false;

    const lastAssistant = [...history].reverse().find((msg) => msg.role === 'assistant');
    const hasPendingAllergenWarning = !!lastAssistant?.safetyFlags?.allergenWarning &&
        lastAssistant?.safetyFlags?.error === true;

    if (!hasPendingAllergenWarning) return false;
    return ALLERGEN_CONFIRMATION_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function ChatScreen({
    sessionId: initialSessionId,
    onSessionCreated,
    messages: externalMessages,
    onMessagesChange,
}: Props) {
    const { user } = useAuth();
    const { language } = useLanguage();
    const queryClient = useQueryClient();
    const insets = useSafeAreaInsets();
    const flatListRef = useRef<FlatList>(null);
    const isMountedRef = useRef(true);
    const streamCancelRef = useRef<(() => void) | null>(null);
    const streamRequestIdRef = useRef(0);
    const assistantIndexRef = useRef<number | null>(null);
    const lastScrollRef = useRef(0);
    const chunkBufferRef = useRef<string>('');
    const chunkTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isNearBottomRef = useRef(true); // Assume at bottom initially
    const skipNextScrollToEndRef = useRef(false); // Skip scroll-to-end after recipe card scroll
    const hasRecipeInCurrentStreamRef = useRef(false); // Prevent auto-scroll when recipe card is showing

    // Use external messages if provided (lifted state), otherwise use local state
    const [internalMessages, setInternalMessages] = useState<ChatMessage[]>([]);
    const messages = externalMessages ?? internalMessages;

    // Unified setter that works with both internal state and external handler
    // Supports both direct value and callback pattern
    const messagesRef = useRef<ChatMessage[]>(messages);
    messagesRef.current = messages;

    const setMessages = useCallback((update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
        const newMessages = typeof update === 'function' ? update(messagesRef.current) : update;
        if (onMessagesChange) {
            onMessagesChange(newMessages);
        } else {
            setInternalMessages(newMessages);
        }
    }, [onMessagesChange]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(initialSessionId ?? null);
    const [currentStatus, setCurrentStatus] = useState<IrmixyStatus>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);

    const { isListening, pulseAnim, handleMicPress, stopAndGuard } = useSpeechRecognition({
        language,
        onTranscript: setInputText,
    });

    const resetStreamingState = useCallback(() => {
        streamCancelRef.current?.();
        streamCancelRef.current = null;
        if (chunkTimerRef.current) {
            clearTimeout(chunkTimerRef.current);
            chunkTimerRef.current = null;
        }
        chunkBufferRef.current = '';
        assistantIndexRef.current = null;
        streamRequestIdRef.current += 1; // Invalidate any in-flight callbacks
        setIsLoading(false);
        setIsStreaming(false);
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

    // Sync currentSessionId when parent changes it (e.g., user switches sessions)
    useEffect(() => {
        const nextSessionId = initialSessionId ?? null;
        if (nextSessionId !== currentSessionId) {
            resetStreamingState();
            setCurrentSessionId(nextSessionId);
        }
    }, [initialSessionId, currentSessionId, resetStreamingState]);

    // Reload messages when component mounts if sessionId is set but no messages exist
    // Skip if external messages are provided (they already contain recipes)
    useEffect(() => {
        if (initialSessionId && messages.length === 0 && user && !externalMessages) {
            loadChatHistory(initialSessionId)
                .then((history) => {
                    if (isMountedRef.current && history.length > 0) {
                        setMessages(history);
                    }
                })
                .catch((err) => {
                    if (__DEV__) console.error('Failed to reload chat history:', err);
                });
        }
    // Only run on mount with initialSessionId
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialSessionId, user]);

    const scrollToEndThrottled = useCallback((animated: boolean) => {
        // Only auto-scroll if user is near bottom (prevents interrupting reading)
        if (!isNearBottomRef.current && !animated) return;

        const now = Date.now();
        if (animated || now - lastScrollRef.current > SCROLL_THROTTLE_MS) {
            lastScrollRef.current = now;
            flatListRef.current?.scrollToEnd({ animated });
        }
    }, []);

    // Get status text based on current status
    const getStatusText = useCallback(() => {
        switch (currentStatus) {
            case 'thinking':
                return i18n.t('chat.thinking');
            case 'searching':
                return i18n.t('chat.searching');
            case 'generating':
                return i18n.t('chat.generating');
            case 'cooking_it_up':
                return i18n.t('chat.cookingItUp');
            case 'enriching':
                return i18n.t('chat.enriching');
            default:
                return i18n.t('chat.thinking');
        }
    }, [currentStatus]);

    // Scroll to bottom when new messages arrive or content updates
    // Skip when recipe card is showing (keeps recipe card pinned at top)
    useEffect(() => {
        if (messages.length > 0) {
            if (skipNextScrollToEndRef.current) {
                skipNextScrollToEndRef.current = false;
                return;
            }
            if (hasRecipeInCurrentStreamRef.current) return;
            setTimeout(() => {
                scrollToEndThrottled(true);
            }, SCROLL_DELAY_MS);
        }
    }, [messages, scrollToEndThrottled]);

    // Scroll to bottom when skeleton appears (status changes to generating)
    useEffect(() => {
        if (currentStatus === 'generating') {
            setTimeout(() => {
                scrollToEndThrottled(true);
            }, SCROLL_DELAY_MS);
        }
    }, [currentStatus, scrollToEndThrottled]);

    const handleSendMessage = useCallback(async (messageText: string) => {
        if (!messageText.trim() || !user || isLoading) return;

        const bypassAllergenBlock = shouldBypassAllergenBlock(
            messageText,
            messagesRef.current,
        );

        streamRequestIdRef.current += 1;
        const requestId = streamRequestIdRef.current;
        const isActiveRequest = () =>
            isMountedRef.current && streamRequestIdRef.current === requestId;

        // Always stop speech recognition on send — stop() is a safe no-op when inactive.
        stopAndGuard();

        const trimmedMessage = messageText.trim();
        const userMessage: ChatMessage = {
            id: `temp-${Date.now()}`,
            role: 'user',
            content: trimmedMessage,
            createdAt: new Date(),
        };

        const assistantMessageId = `assistant-${Date.now()}`;

        // Add user message and empty assistant message for streaming
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
        setIsStreaming(false); // Not streaming yet, just thinking
        setCurrentStatus('thinking');

        // Reset to auto-scroll for new message
        isNearBottomRef.current = true;
        hasRecipeInCurrentStreamRef.current = false;

        // Clear chunk buffer for new message
        chunkBufferRef.current = '';
        if (chunkTimerRef.current) {
            clearTimeout(chunkTimerRef.current);
            chunkTimerRef.current = null;
        }

        // Track whether onComplete ran (to avoid duplicate state resets in finally)
        let completedSuccessfully = false;

        // Flush accumulated chunks to UI
        const flushChunkBuffer = () => {
            if (!chunkBufferRef.current || !isActiveRequest()) return;

            const bufferedContent = chunkBufferRef.current;
            chunkBufferRef.current = '';

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
                    updated[assistantIdx] = {
                        ...updated[assistantIdx],
                        content: updated[assistantIdx].content + bufferedContent,
                    };
                }
                return updated;
            });
            if (!hasRecipeInCurrentStreamRef.current) {
                scrollToEndThrottled(false);
            }
        };

        try {
            const handle = sendMessage(
                userMessage.content,
                currentSessionId,
                // onChunk - batch updates to reduce re-renders
                (chunk) => {
                    if (!isActiveRequest()) return;

                    // Now streaming - block input
                    setIsStreaming(true);

                    // Accumulate chunk in buffer
                    chunkBufferRef.current += chunk;

                    // Schedule flush if not already scheduled
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
                // onStatus - update loading indicator text
                (status) => {
                    if (!isActiveRequest()) return;
                    setCurrentStatus(status);
                },
                // onStreamComplete - text streaming finished, enable input before suggestions arrive
                () => {
                    if (!isActiveRequest()) return;
                    // Enable input immediately when text streaming completes
                    // Don't wait for suggestions - they'll update the UI when they arrive
                    setIsLoading(false);
                    setIsStreaming(false);
                    setCurrentStatus(null);
                },
                // onPartialRecipe - show recipe card immediately before enrichment completes
                (partialRecipe) => {
                    if (!isActiveRequest()) return;

                    if (__DEV__) {
                        console.log('[ChatScreen] onPartialRecipe received:', {
                            recipeName: partialRecipe.suggestedName,
                            hasIngredients: !!partialRecipe.ingredients?.length,
                            hasSteps: !!partialRecipe.steps?.length,
                        });
                    }

                    // Prevent auto-scroll to bottom while recipe card is visible
                    hasRecipeInCurrentStreamRef.current = true;

                    // Update message with partial recipe to show card immediately
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
                            updated[assistantIdx] = {
                                ...updated[assistantIdx],
                                customRecipe: partialRecipe,
                            };
                        }
                        return updated;
                    });

                    // Scroll to recipe card at top of viewport
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
                // onComplete - receive full IrmixyResponse with recipes/suggestions/customRecipe
                (response) => {
                    if (!isActiveRequest()) return;

                    // DEBUG: Log what we received from the backend
                    if (__DEV__) {
                        console.log('[ChatScreen] onComplete received:', {
                            hasMessage: !!response.message,
                            messagePreview: response.message?.substring(0, 50),
                            hasCustomRecipe: !!response.customRecipe,
                            customRecipeName: response.customRecipe?.suggestedName,
                            hasRecipes: !!response.recipes?.length,
                            hasSuggestions: !!response.suggestions?.length,
                            safetyFlags: response.safetyFlags,
                        });
                    }

                    // Clear any pending flush timer
                    if (chunkTimerRef.current) {
                        clearTimeout(chunkTimerRef.current);
                        chunkTimerRef.current = null;
                    }

                    // Capture buffered content before clearing
                    const bufferedContent = chunkBufferRef.current;
                    chunkBufferRef.current = '';

                    const hasRecipeData =
                        (response.recipes && response.recipes.length > 0) || response.customRecipe;

                    // SINGLE atomic update with all data (text + recipe together)
                    // This prevents race conditions where text appears without the recipe card
                    if (bufferedContent || hasRecipeData) {
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
                                // Determine final content
                                let finalContent = updated[assistantIdx].content;

                                // Append buffered content if any
                                if (bufferedContent) {
                                    finalContent += bufferedContent;
                                }

                                // For recipes, use response.message (overrides streamed content)
                                if (response.customRecipe && response.message) {
                                    finalContent = response.message;
                                }

                                updated[assistantIdx] = {
                                    ...updated[assistantIdx],
                                    content: finalContent,
                                    recipes: hasRecipeData
                                        ? response.recipes
                                        : updated[assistantIdx].recipes,
                                    customRecipe: hasRecipeData
                                        ? response.customRecipe
                                        : updated[assistantIdx].customRecipe,
                                    safetyFlags: hasRecipeData
                                        ? response.safetyFlags
                                        : updated[assistantIdx].safetyFlags,
                                    actions: response.actions,
                                };

                                // DEBUG: Log the message update
                                if (__DEV__) {
                                    console.log('[ChatScreen] Updated message:', {
                                        messageId: updated[assistantIdx].id,
                                        hasCustomRecipe: !!updated[assistantIdx].customRecipe,
                                        recipeName: updated[assistantIdx].customRecipe?.suggestedName,
                                        hasBufferedContent: !!bufferedContent,
                                    });
                                }
                            }
                            return updated;
                        });
                    }

                    // When recipes/cards arrive, scroll the assistant message to the top
                    // so the user sees the intro text with cards flowing below it
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
                    // Allow user to start typing immediately after response completes
                    // Don't wait for handle.done - text and suggestions are already received
                    setIsLoading(false);
                    setIsStreaming(false);
                    setCurrentStatus(null);
                    hasRecipeInCurrentStreamRef.current = false;
                    completedSuccessfully = true;
                },
                {
                    bypassAllergenBlock,
                },
            );

            // Wrap cancel to flush partial message before canceling
            streamCancelRef.current = () => {
                // Flush any buffered chunks to show partial message
                if (chunkTimerRef.current) {
                    clearTimeout(chunkTimerRef.current);
                    chunkTimerRef.current = null;
                }
                flushChunkBuffer();
                // Then cancel the stream
                handle.cancel();
            };
            await handle.done;

            // Guard cleanup - a new request may have started while we were awaiting
            if (!isActiveRequest()) return;

            // Flush any remaining buffered chunks
            if (chunkTimerRef.current) {
                clearTimeout(chunkTimerRef.current);
                chunkTimerRef.current = null;
            }
            flushChunkBuffer();
        } catch (error) {
            // Guard cleanup - a new request may have started
            if (!isActiveRequest()) return;

            // Flush any remaining chunks before error handling
            if (chunkTimerRef.current) {
                clearTimeout(chunkTimerRef.current);
                chunkTimerRef.current = null;
            }
            flushChunkBuffer();

            // Determine user-friendly error message based on error type
            const getErrorMessage = () => {
                if (error instanceof TypeError && error.message.includes('fetch')) {
                    return i18n.t('chat.error.networkError');
                }
                if (error instanceof Error && error.message.includes('recipe')) {
                    return i18n.t('chat.error.recipeGeneration');
                }
                return i18n.t('chat.error.default');
            };

            // Replace streaming message with error
            if (isActiveRequest()) {
                const errorMessage = getErrorMessage();

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
                        // If there's partial content, append error. Otherwise, show error.
                        const existingContent = updated[assistantIdx].content;
                        updated[assistantIdx] = {
                            ...updated[assistantIdx],
                            content: existingContent
                                ? `${existingContent}\n\n⚠️ ${errorMessage}`
                                : `⚠️ ${errorMessage}`,
                            hasError: true,
                        };
                    }
                    return updated;
                });

                // Log error for debugging but don't show raw error to user
                if (__DEV__) console.error('Chat error:', error);
            }
        } finally {
            // Only reset state if onComplete didn't already handle it (error cases)
            if (isActiveRequest() && !completedSuccessfully) {
                setIsLoading(false);
                setIsStreaming(false);
                setCurrentStatus(null);
            }
            // Always clear cancel ref
            streamCancelRef.current = null;
        }
    }, [
        currentSessionId,
        isLoading,
        onSessionCreated,
        scrollToEndThrottled,
        setMessages,
        user,
        // messagesRef is intentionally excluded (refs are stable and don't need to be in deps)
        // assistantIndexRef, streamCancelRef, chunkTimerRef, etc. are also excluded for same reason
    ]);

    const handleSend = useCallback(() => {
        handleSendMessage(inputText);
    }, [inputText, handleSendMessage]);

    const handleCopyMessage = useCallback(async (content: string) => {
        try {
            await Clipboard.setStringAsync(content);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Show brief confirmation
            if (Platform.OS === 'ios') {
                Alert.alert(i18n.t('common.copied'), i18n.t('chat.messageCopied'), [{ text: i18n.t('common.ok') }], { userInterfaceStyle: 'automatic' });
            } else {
                Alert.alert(i18n.t('common.copied'), i18n.t('chat.messageCopied'));
            }
        } catch (error) {
            if (__DEV__) console.error('Failed to copy message:', error);
        }
    }, []);

    const handleStartCooking = useCallback(async (
        recipe: GeneratedRecipe,
        finalName: string,
        messageId: string,
        savedRecipeId?: string
    ) => {
        try {
            let recipeId = savedRecipeId;

            // Only save if not already saved
            if (!recipeId) {
                const { userRecipeId } = await customRecipeService.save(recipe, finalName);
                recipeId = userRecipeId;

                // Update the message with the saved recipe ID to prevent duplicate saves
                setMessages(prev => prev.map(msg =>
                    msg.id === messageId
                        ? { ...msg, savedRecipeId: recipeId }
                        : msg
                ));

                // Invalidate all custom recipe queries to ensure fresh data
                await queryClient.invalidateQueries({ queryKey: customRecipeKeys.all });
            }

            // Debug: log the recipe being saved and navigation target
            if (__DEV__) {
                console.log('[ChatScreen] Starting cooking - recipe ID:', recipeId, 'name:', finalName, 'wasAlreadySaved:', !!savedRecipeId);
            }

            router.push(getChatCustomCookingGuidePath(recipeId));
        } catch (error) {
            if (__DEV__) console.error('Failed to save custom recipe:', error);
            Alert.alert(
                i18n.t('chat.error.title'),
                i18n.t('chat.saveFailed'),
                [{ text: i18n.t('common.ok') }]
            );
        }
    }, [queryClient, setMessages]);

    const handleActionPress = useCallback((action: QuickAction) => {
        const payload = action.payload || {};
        switch (action.type) {
            case 'view_recipe': {
                const recipeId = payload.recipeId as string;
                if (recipeId) {
                    router.push(getChatRecipeDetailPath(recipeId));
                }
                break;
            }
            default:
                break;
        }
    }, []);

    // Memoize the last message ID to avoid recalculating on every render
    const lastMessageId = messages.length > 0 ? messages[messages.length - 1]?.id : null;

    // Memoize status text to avoid function call on each item
    const statusText = useMemo(() => getStatusText(), [getStatusText]);

    // Use memoized component to avoid re-renders of all items when one changes
    const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
        return (
            <ChatMessageItem
                item={item}
                isLastMessage={item.id === lastMessageId}
                isLoading={isLoading}
                currentStatus={currentStatus}
                statusText={statusText}
                onCopyMessage={handleCopyMessage}
                onStartCooking={handleStartCooking}
                onActionPress={handleActionPress}
            />
        );
    }, [lastMessageId, isLoading, currentStatus, statusText, handleCopyMessage, handleStartCooking, handleActionPress]);

    const handleScroll = useCallback((event: any) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);

        // Consider "near bottom" if within threshold
        const isNearBottom = distanceFromBottom <= SCROLL_THRESHOLD;
        isNearBottomRef.current = isNearBottom;

        // Show scroll button when user is not near bottom and there's content
        setShowScrollButton(!isNearBottom && contentSize.height > layoutMeasurement.height);
    }, []);

    const handleScrollToBottom = useCallback(() => {
        isNearBottomRef.current = true;
        setShowScrollButton(false);
        flatListRef.current?.scrollToEnd({ animated: true });
    }, []);

    if (!user) {
        return (
            <View className="flex-1 justify-center items-center px-lg">
                <Text className="text-text-secondary text-center">{i18n.t('chat.loginRequired')}</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            className="flex-1 bg-background-default"
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={insets.top + 60}
        >
            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={keyExtractor}
                contentContainerStyle={{ padding: 16, flexGrow: 1 }}
                onScroll={handleScroll}
                scrollEventThrottle={200}
                // Performance optimizations to prevent flashing and reduce re-renders
                removeClippedSubviews={Platform.OS !== 'web'}
                maxToRenderPerBatch={3}
                updateCellsBatchingPeriod={50}
                windowSize={5}
                initialNumToRender={8}
                getItemLayout={undefined}
                maintainVisibleContentPosition={{
                    minIndexForVisible: 0,
                }}
                onScrollToIndexFailed={(info) => {
                    // Retry scroll after layout completes
                    setTimeout(() => {
                        flatListRef.current?.scrollToIndex({
                            index: info.index,
                            viewPosition: 0,
                            animated: true,
                        });
                    }, 100);
                }}
                ListEmptyComponent={
                    <View className="flex-1 justify-center items-center pt-xxxl">
                        <Image
                            source={require('@/assets/images/irmixy-avatar/irmixy-with-book.png')}
                            style={{ width: 120, height: 120 }}
                            contentFit="contain"
                        />
                        <Text className="text-text-secondary text-center mt-md px-xl">
                            {i18n.t('chat.greeting')}
                        </Text>
                    </View>
                }
            />

            {/* Scroll to bottom button */}
            {showScrollButton && (
                <TouchableOpacity
                    onPress={handleScrollToBottom}
                    className="absolute right-4 bottom-40 z-50 bg-primary-default rounded-full p-3 shadow-lg"
                    style={{ elevation: 4 }}
                >
                    <MaterialCommunityIcons name="chevron-double-down" size={24} color="white" />
                </TouchableOpacity>
            )}

            {/* Status indicator with avatar */}
            {isLoading && (
                <View className="px-md py-sm">
                    <View className="flex-row items-center">
                        <IrmixyAvatar state={currentStatus ?? 'thinking'} size={40} />
                        <Text className="text-text-secondary ml-sm text-sm">
                            {getStatusText()}
                        </Text>
                        <TypingDots />
                    </View>
                </View>
            )}

            <View
                className="border-t border-border-default bg-background-default"
                style={{
                    paddingTop: SPACING.sm,
                    paddingBottom: Math.max(insets.bottom, SPACING.md),
                }}
            >
                {/* Mic pill — inside bordered section, above input row */}
                {Platform.OS !== 'web' && (!isLoading || isListening) && (
                    <TouchableOpacity
                        onPress={handleMicPress}
                        activeOpacity={0.7}
                        style={{ paddingHorizontal: SPACING.md, marginBottom: SPACING.sm }}
                    >
                        <Animated.View
                            className={`flex-row items-center justify-center rounded-full ${
                                isListening
                                    ? 'bg-status-error'
                                    : 'bg-background-secondary border border-border-default'
                            }`}
                            style={[
                                { height: SPACING.xxl, paddingHorizontal: SPACING.md },
                                isListening ? { opacity: pulseAnim } : undefined,
                            ]}
                        >
                            <MaterialCommunityIcons
                                name={isListening ? 'stop' : 'microphone'}
                                size={ICON_SIZE}
                                color={isListening ? COLORS.neutral.white : COLORS.text.secondary}
                            />
                            <Text
                                className={`ml-xs text-sm font-medium ${
                                    isListening ? 'text-white' : 'text-text-secondary'
                                }`}
                            >
                                {isListening
                                    ? i18n.t('chat.voice.listening')
                                    : i18n.t('chat.voice.tapToSpeak')}
                            </Text>
                        </Animated.View>
                    </TouchableOpacity>
                )}
                <View
                    className="flex-row items-center"
                    style={{ paddingHorizontal: SPACING.sm }}
                >
                    <TextInput
                        className="flex-1 bg-background-secondary rounded-xl text-base text-text-primary"
                        style={{ minHeight: SPACING.xxl, maxHeight: 120, paddingLeft: SPACING.md, paddingRight: SPACING.sm, paddingVertical: SPACING.xs }}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder={isListening ? i18n.t('chat.voice.listening') : i18n.t('chat.inputPlaceholder')}
                        placeholderTextColor={COLORS.text.secondary}
                        multiline
                        maxLength={2000}
                        editable={!isLoading}
                    />
                    <TouchableOpacity
                        className={`rounded-full justify-center items-center ${
                            isLoading ? 'bg-primary-medium' :
                            !inputText.trim() ? 'bg-grey-medium' : 'bg-primary-darkest'
                        }`}
                        style={{ width: SPACING.xxl, height: SPACING.xxl, marginLeft: SPACING.xs }}
                        onPress={handleSend}
                        disabled={isLoading || !inputText.trim()}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color={COLORS.neutral.white} />
                        ) : (
                            <MaterialCommunityIcons name="send" size={ICON_SIZE} color={COLORS.neutral.white} />
                        )}
                    </TouchableOpacity>
                </View>
            </View>

        </KeyboardAvoidingView>
    );
}
