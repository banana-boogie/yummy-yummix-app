import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
    View,
    TextInput,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    Pressable,
    ActivityIndicator,
    Alert,
    Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/common/Text';
import { SuggestionChips } from '@/components/chat/SuggestionChips';
import { IrmixyAvatar } from '@/components/chat/IrmixyAvatar';
import { ChatRecipeCard } from '@/components/chat/ChatRecipeCard';
import { CustomRecipeCard } from '@/components/chat/CustomRecipeCard';
import { RecipeGeneratingSkeleton } from '@/components/chat/RecipeGeneratingSkeleton';
import { ChatMessage, IrmixyStatus, SuggestionChip, RecipeCard, GeneratedRecipe, getLastSessionWithMessages, loadChatHistory } from '@/services/chatService';
import { customRecipeService } from '@/services/customRecipeService';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Markdown from 'react-native-markdown-display';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import i18n from '@/i18n';
import { COLORS } from '@/constants/design-tokens';

// Constants
const SCROLL_THROTTLE_MS = 100; // Throttle scroll calls to avoid excessive layout calculations
const SCROLL_DELAY_MS = 100; // Allow render to complete before scrolling
const CHUNK_BATCH_MS = 50; // Batch streaming chunks to reduce re-renders
const SCROLL_THRESHOLD = 100; // Distance from bottom to consider "at bottom" (px)

// Markdown styles for assistant messages
const markdownStyles = {
    body: {
        color: COLORS.text.primary,
        fontSize: 16,
        lineHeight: 24,
    },
    paragraph: {
        marginTop: 0,
        marginBottom: 8,
    },
    strong: {
        fontWeight: '600' as const,
    },
    em: {
        fontStyle: 'italic' as const,
    },
    list_item: {
        marginBottom: 4,
    },
    bullet_list: {
        marginBottom: 8,
    },
    ordered_list: {
        marginBottom: 8,
    },
    code_inline: {
        backgroundColor: COLORS.background.secondary,
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
        fontFamily: 'monospace',
    },
    code_block: {
        backgroundColor: COLORS.background.secondary,
        padding: 8,
        borderRadius: 8,
        marginBottom: 8,
        fontFamily: 'monospace',
    },
    link: {
        color: COLORS.primary.darkest,
        textDecorationLine: 'underline' as const,
    },
    image: {
        width: 200,
        height: 150,
        borderRadius: 8,
        marginVertical: 8,
    },
};

// Factory function to create markdown rules with access to message recipes
const createMarkdownRules = (recipes?: RecipeCard[]) => ({
    image: (node: any, _children: any, _parent: any, styles: any) => {
        const { src } = node.attributes;

        // Try to find matching recipe by image URL
        const matchingRecipe = recipes?.find(r => r.imageUrl === src);

        const imageElement = (
            <Image
                key={node.key}
                source={{ uri: src }}
                style={styles.image}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={0}
                placeholder={null}
            />
        );

        // If we found a matching recipe, make the image clickable
        if (matchingRecipe?.recipeId) {
            return (
                <TouchableOpacity
                    key={node.key}
                    onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push(`/(tabs)/recipes/${matchingRecipe.recipeId}?from=chat`);
                    }}
                    activeOpacity={0.8}
                >
                    {imageElement}
                </TouchableOpacity>
            );
        }

        return imageElement;
    },
});

interface Props {
    sessionId?: string | null;
    onSessionCreated?: (sessionId: string) => void;
    // Optional: lift messages state to parent to preserve recipes when switching modes
    messages?: ChatMessage[];
    onMessagesChange?: (messages: ChatMessage[]) => void;
}

// Animated typing dots component
const TypingDots = React.memo(function TypingDots() {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animateDot = (dot: Animated.Value, delay: number) => {
            return Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    // Bounce up 4px over 200ms, then back down
                    Animated.timing(dot, { toValue: -4, duration: 200, useNativeDriver: true }),
                    Animated.timing(dot, { toValue: 0, duration: 200, useNativeDriver: true }),
                ])
            );
        };

        const animations = [
            animateDot(dot1, 0),
            animateDot(dot2, 150),
            animateDot(dot3, 300),
        ];

        animations.forEach(anim => anim.start());
        return () => animations.forEach(anim => anim.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Animated.Value refs are stable, no need to include in deps

    return (
        <View className="flex-row items-center ml-sm gap-1">
            <Animated.View className="w-2 h-2 bg-grey-medium rounded-full" style={{ transform: [{ translateY: dot1 }] }} />
            <Animated.View className="w-2 h-2 bg-grey-medium rounded-full" style={{ transform: [{ translateY: dot2 }] }} />
            <Animated.View className="w-2 h-2 bg-grey-medium rounded-full" style={{ transform: [{ translateY: dot3 }] }} />
        </View>
    );
});

export function ChatScreen({
    sessionId: initialSessionId,
    onSessionCreated,
    messages: externalMessages,
    onMessagesChange,
}: Props) {
    const { user } = useAuth();
    const { language } = useLanguage();
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
    const [dynamicSuggestions, setDynamicSuggestions] = useState<SuggestionChip[] | null>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [hasCheckedResume, setHasCheckedResume] = useState(false);

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

    useEffect(() => {
        setDynamicSuggestions(null);
    }, [language]);

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

    // Check for resumable session on mount (only if no initial session provided)
    useEffect(() => {
        if (hasCheckedResume || initialSessionId || !user) return;

        const checkResumableSession = async () => {
            try {
                const lastSession = await getLastSessionWithMessages();
                if (lastSession && lastSession.messageCount > 0) {
                    Alert.alert(
                        i18n.t('chat.resumeSession.title'),
                        i18n.t('chat.resumeSession.message'),
                        [
                            {
                                text: i18n.t('chat.resumeSession.startNew'),
                                style: 'cancel',
                            },
                            {
                                text: i18n.t('chat.resumeSession.resume'),
                                onPress: async () => {
                                    try {
                                        const history = await loadChatHistory(lastSession.sessionId);
                                        if (isMountedRef.current) {
                                            setMessages(history);
                                            setCurrentSessionId(lastSession.sessionId);
                                            onSessionCreated?.(lastSession.sessionId);
                                        }
                                    } catch (err) {
                                        if (__DEV__) console.error('Failed to load chat history:', err);
                                    }
                                },
                            },
                        ]
                    );
                }
            } catch (err) {
                if (__DEV__) console.error('Failed to check resumable session:', err);
            } finally {
                setHasCheckedResume(true);
            }
        };

        checkResumableSession();
    }, [hasCheckedResume, initialSessionId, user, onSessionCreated]);

    const scrollToEndThrottled = useCallback((animated: boolean) => {
        // Only auto-scroll if user is near bottom (prevents interrupting reading)
        if (!isNearBottomRef.current && !animated) return;

        const now = Date.now();
        if (animated || now - lastScrollRef.current > SCROLL_THROTTLE_MS) {
            lastScrollRef.current = now;
            flatListRef.current?.scrollToEnd({ animated });
        }
    }, []);

    // Get initial suggestions from i18n - recompute when language changes
    const initialSuggestions = useMemo(() => [
        { label: i18n.t('chat.suggestions.suggestRecipe'), message: i18n.t('chat.suggestions.suggestRecipe') },
        { label: i18n.t('chat.suggestions.whatCanICook'), message: i18n.t('chat.suggestions.whatCanICook') },
        { label: i18n.t('chat.suggestions.quickMeal'), message: i18n.t('chat.suggestions.quickMeal') },
        { label: i18n.t('chat.suggestions.ingredientsIHave'), message: i18n.t('chat.suggestions.ingredientsIHave') },
        { label: i18n.t('chat.suggestions.healthyOptions'), message: i18n.t('chat.suggestions.healthyOptions') },
    ], [language]);

    // Use dynamic suggestions if available, otherwise fallback to initial
    const currentSuggestions = dynamicSuggestions || initialSuggestions;

    // Show suggestions only when chat is empty OR when AI explicitly provides suggestions
    const showSuggestions = messages.length === 0 ||
        (dynamicSuggestions && dynamicSuggestions.length > 0 && !isLoading);

    const buildRecipeSuggestions = useCallback((recipes: Array<{ name: string }>): SuggestionChip[] => {
        const suggestions: SuggestionChip[] = [];

        if (recipes && recipes.length > 0) {
            // Add top 2 recipes from search results
            suggestions.push(...recipes.slice(0, 2).map((recipe) => ({
                label: recipe.name,
                message: i18n.t('chat.suggestions.tellMeAboutRecipe', {
                    recipeName: recipe.name,
                }),
            })));
        }

        // ALWAYS add "Custom Recipe" option
        suggestions.push({
            label: i18n.t('chat.suggestions.createCustom'),
            message: i18n.t('chat.suggestions.createCustomRecipeMessage'),
        });

        return suggestions;
    }, [language]);

    // Get status text based on current status
    const getStatusText = useCallback(() => {
        switch (currentStatus) {
            case 'thinking':
                return i18n.t('chat.thinking');
            case 'searching':
                return i18n.t('chat.searching');
            case 'generating':
                return i18n.t('chat.generating');
            default:
                return i18n.t('chat.thinking');
        }
    }, [currentStatus]);

    // Scroll to bottom when new messages arrive or content updates
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => {
                scrollToEndThrottled(true);
            }, SCROLL_DELAY_MS);
        }
    }, [messages, scrollToEndThrottled]);

    const handleSendMessage = useCallback(async (messageText: string) => {
        if (!messageText.trim() || !user) return;

        // If already loading, cancel current request and start new one
        if (isLoading) {
            streamCancelRef.current?.();
            streamCancelRef.current = null;
        }

        streamRequestIdRef.current += 1;
        const requestId = streamRequestIdRef.current;
        const isActiveRequest = () =>
            isMountedRef.current && streamRequestIdRef.current === requestId;

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
        setDynamicSuggestions(null); // Clear previous suggestions

        // Reset to auto-scroll for new message
        isNearBottomRef.current = true;

        // Clear chunk buffer for new message
        chunkBufferRef.current = '';
        if (chunkTimerRef.current) {
            clearTimeout(chunkTimerRef.current);
            chunkTimerRef.current = null;
        }

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
            scrollToEndThrottled(false);
        };

        try {
            // Import stream function with cancellation handle
            const { streamChatMessageWithHandle } = await import('@/services/chatService');

            const handle = streamChatMessageWithHandle(
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
                // onComplete - receive full IrmixyResponse with recipes/suggestions/customRecipe
                (response) => {
                    if (!isActiveRequest()) return;
                    // Update the message with recipes or customRecipe if present
                    if ((response.recipes && response.recipes.length > 0) || response.customRecipe) {
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
                                    recipes: response.recipes,
                                    customRecipe: response.customRecipe,
                                    safetyFlags: response.safetyFlags,
                                };
                            }
                            return updated;
                        });
                    }
                    // Update suggestions if present
                    if (response.suggestions && response.suggestions.length > 0) {
                        setDynamicSuggestions(response.suggestions);
                    } else {
                        setDynamicSuggestions(buildRecipeSuggestions(response.recipes ?? []));
                    }
                }
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

            // Flush any remaining buffered chunks
            if (chunkTimerRef.current) {
                clearTimeout(chunkTimerRef.current);
                chunkTimerRef.current = null;
            }
            flushChunkBuffer();
        } catch (error) {
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
            if (isActiveRequest()) {
                setIsLoading(false);
                setIsStreaming(false);
                setCurrentStatus(null);
                streamCancelRef.current = null;
            }
        }
    }, [
        buildRecipeSuggestions,
        currentSessionId,
        isLoading,
        onSessionCreated,
        scrollToEndThrottled,
        setMessages,
        user,
    ]);

    const handleSend = useCallback(() => {
        handleSendMessage(inputText);
    }, [inputText, handleSendMessage]);

    const handleSuggestionSelect = useCallback((suggestion: SuggestionChip) => {
        // Use the message field for sending (may differ from label)
        handleSendMessage(suggestion.message);
    }, [handleSendMessage]);

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

    const handleStartCooking = useCallback(async (recipe: GeneratedRecipe, finalName: string) => {
        try {
            // Save recipe to user_recipes
            const { userRecipeId } = await customRecipeService.save(recipe, finalName);

            // Navigate to custom cooking guide
            router.push(`/(tabs)/recipes/custom/${userRecipeId}/cooking-guide?from=chat`);
        } catch (error) {
            console.error('Failed to save custom recipe:', error);
            Alert.alert(
                i18n.t('chat.error.title'),
                i18n.t('chat.saveFailed'),
                [{ text: i18n.t('common.ok') }]
            );
        }
    }, []);

    const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
        const isUser = item.role === 'user';

        return (
            <View className="mb-sm">
                {/* RECIPE CARDS FIRST (for assistant messages) */}
                {!isUser && item.recipes && item.recipes.length > 0 && (
                    <View className="mb-sm w-full">
                        {item.recipes.map((recipe) => (
                            <ChatRecipeCard key={recipe.recipeId} recipe={recipe} />
                        ))}
                    </View>
                )}

                {/* Custom recipe card (for AI-generated recipes) */}
                {!isUser && item.customRecipe && (
                    <View className="mb-sm w-full">
                        <CustomRecipeCard
                            recipe={item.customRecipe}
                            safetyFlags={item.safetyFlags}
                            onStartCooking={handleStartCooking}
                        />
                    </View>
                )}

                {/* Show skeleton while generating recipe (for the current streaming message) */}
                {!isUser && !item.customRecipe && isLoading && currentStatus === 'generating' &&
                    item.id === messages[messages.length - 1]?.id &&
                    (!item.content || item.content.trim().length === 0) && (
                    <View className="mb-sm w-full">
                        <RecipeGeneratingSkeleton statusMessage={getStatusText()} />
                    </View>
                )}

                {/* TEXT MESSAGE BUBBLE (after cards) */}
                {item.content && item.content.trim().length > 0 && (
                    isUser ? (
                        <TouchableOpacity
                            onLongPress={() => handleCopyMessage(item.content)}
                            activeOpacity={0.7}
                            className="max-w-[80%] p-sm rounded-lg self-end bg-primary-default"
                        >
                            <Text className="text-base leading-relaxed text-white">
                                {item.content}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        // Use Pressable for assistant messages to allow individual image touches
                        <Pressable
                            onLongPress={() => handleCopyMessage(item.content)}
                            className="max-w-[80%] p-sm rounded-lg self-start bg-background-secondary"
                        >
                            <Markdown
                                style={markdownStyles}
                                rules={createMarkdownRules(item.recipes)}
                            >
                                {item.content}
                            </Markdown>
                        </Pressable>
                    )
                )}
            </View>
        );
    }, [handleCopyMessage, handleStartCooking, isLoading, currentStatus, messages, getStatusText]);

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
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, flexGrow: 1 }}
                onScroll={handleScroll}
                scrollEventThrottle={200}
                // Performance optimizations to prevent flashing
                removeClippedSubviews={Platform.OS !== 'web'}
                maxToRenderPerBatch={5}
                windowSize={7}
                initialNumToRender={10}
                getItemLayout={undefined}
                maintainVisibleContentPosition={{
                    minIndexForVisible: 0,
                }}
                ListEmptyComponent={
                    <View className="flex-1 justify-center items-center pt-xxxl">
                        <Image
                            source={require('@/assets/images/irmixy-avatar/7.png')}
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

            {/* Suggestion chips above input */}
            {showSuggestions && (
                <SuggestionChips
                    suggestions={currentSuggestions}
                    onSelect={handleSuggestionSelect}
                    disabled={isLoading}
                />
            )}

            <View
                className="flex-row items-end px-md pt-sm border-t border-border-default bg-background-default"
                style={{ paddingBottom: insets.bottom || 16 }}
            >
                <TextInput
                    className="flex-1 min-h-[40px] max-h-[120px] bg-background-secondary rounded-lg px-md py-sm text-base text-text-primary mr-sm"
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder={i18n.t('chat.inputPlaceholder')}
                    placeholderTextColor="#999"
                    multiline
                    maxLength={2000}
                    editable={!isStreaming}
                />
                <TouchableOpacity
                    className={`w-10 h-10 rounded-full justify-center items-center ${!inputText.trim() && !isLoading ? 'bg-grey-medium' : 'bg-primary-darkest'
                        }`}
                    onPress={handleSend}
                    disabled={!inputText.trim() && !isLoading}
                >
                    {isLoading && !isStreaming ? (
                        <MaterialCommunityIcons name="close" size={20} color="#fff" />
                    ) : isStreaming ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <MaterialCommunityIcons name="send" size={20} color="#fff" />
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}
