import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
    View,
    TextInput,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/common/Text';
import { SuggestionChips } from '@/components/chat/SuggestionChips';
import { IrmixyAvatar } from '@/components/chat/IrmixyAvatar';
import { ChatRecipeCard } from '@/components/chat/ChatRecipeCard';
import { ChatMessage, IrmixyStatus, SuggestionChip } from '@/services/chatService';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import i18n from '@/i18n';

interface Props {
    sessionId?: string | null;
    onSessionCreated?: (sessionId: string) => void;
}

export function ChatScreen({ sessionId: initialSessionId, onSessionCreated }: Props) {
    const { user } = useAuth();
    const { language } = useLanguage();
    const insets = useSafeAreaInsets();
    const flatListRef = useRef<FlatList>(null);
    const isMountedRef = useRef(true);
    const streamCancelRef = useRef<(() => void) | null>(null);
    const streamRequestIdRef = useRef(0);
    const assistantIndexRef = useRef<number | null>(null);
    const lastScrollRef = useRef(0);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(initialSessionId ?? null);
    const [currentStatus, setCurrentStatus] = useState<IrmixyStatus>(null);
    const [dynamicSuggestions, setDynamicSuggestions] = useState<SuggestionChip[] | null>(null);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            streamCancelRef.current?.();
            streamCancelRef.current = null;
        };
    }, []);

    const scrollToEndThrottled = useCallback((animated: boolean) => {
        const now = Date.now();
        if (animated || now - lastScrollRef.current > 100) {
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

    // Show suggestions only when chat is empty or after AI response
    const showSuggestions = messages.length === 0 ||
        (messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && !isLoading);

    const buildRecipeSuggestions = useCallback((recipes: Array<{ name: string }>): SuggestionChip[] => {
        if (!recipes || recipes.length === 0) {
            return [
                {
                    label: i18n.t('chat.suggestions.createCustomRecipeLabel'),
                    message: i18n.t('chat.suggestions.createCustomRecipeMessage'),
                },
            ];
        }

        return recipes.slice(0, 3).map((recipe) => ({
            label: recipe.name,
            message: i18n.t('chat.suggestions.tellMeAboutRecipe', {
                recipeName: recipe.name,
            }),
        }));
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
            }, 100);
        }
    }, [messages, scrollToEndThrottled]);

    const handleSendMessage = useCallback(async (messageText: string) => {
        if (!messageText.trim() || isLoading || !user) return;

        // Cancel any in-flight stream before starting a new one
        streamCancelRef.current?.();
        streamCancelRef.current = null;

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
        setCurrentStatus('thinking');
        setDynamicSuggestions(null); // Clear previous suggestions

        try {
            // Import stream function with cancellation handle
            const { streamChatMessageWithHandle } = await import('@/services/chatService');

            const handle = streamChatMessageWithHandle(
                userMessage.content,
                currentSessionId,
                // onChunk - append content progressively
                (chunk) => {
                    if (!isActiveRequest()) return;
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
                                content: updated[assistantIdx].content + chunk,
                            };
                        }
                        return updated;
                    });
                    // Scroll during streaming, but throttle to avoid excessive work
                    scrollToEndThrottled(false);
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
                // onComplete - receive full IrmixyResponse with recipes/suggestions
                (response) => {
                    if (!isActiveRequest()) return;
                    // Update the message with recipes if present
                    if (response.recipes && response.recipes.length > 0) {
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

            streamCancelRef.current = handle.cancel;
            await handle.done;
        } catch (error) {
            // Replace streaming message with error
            if (isActiveRequest()) {
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
                            content: updated[assistantIdx].content || i18n.t('chat.error'),
                        };
                    }
                    return updated;
                });
            }
        } finally {
            if (isActiveRequest()) {
                setIsLoading(false);
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
        user,
    ]);

    const handleSend = useCallback(() => {
        handleSendMessage(inputText);
    }, [inputText, handleSendMessage]);

    const handleSuggestionSelect = useCallback((suggestion: SuggestionChip) => {
        // Use the message field for sending (may differ from label)
        handleSendMessage(suggestion.message);
    }, [handleSendMessage]);

    const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
        const isUser = item.role === 'user';

        return (
            <View className="mb-sm">
                {/* Message bubble */}
                <View
                    className={`max-w-[80%] p-sm rounded-lg ${isUser ? 'self-end bg-primary-default' : 'self-start bg-background-secondary'
                        }`}
                >
                    <Text className={`text-base leading-relaxed ${isUser ? 'text-white' : 'text-text-primary'}`}>
                        {item.content}
                    </Text>
                </View>

                {/* Recipe cards (only for assistant messages with recipes) */}
                {!isUser && item.recipes && item.recipes.length > 0 && (
                    <View className="mt-sm self-start max-w-[95%]">
                        {item.recipes.map((recipe) => (
                            <ChatRecipeCard key={recipe.recipeId} recipe={recipe} />
                        ))}
                    </View>
                )}
            </View>
        );
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
                ListEmptyComponent={
                    <View className="flex-1 justify-center items-center pt-xxxl">
                        <MaterialCommunityIcons name="chef-hat" size={48} color="#999" />
                        <Text className="text-text-secondary text-center mt-md px-xl">
                            {i18n.t('chat.greeting')}
                        </Text>
                    </View>
                }
            />

            {/* Status indicator with avatar */}
            {isLoading && (
                <View className="flex-row items-center px-md py-sm">
                    <IrmixyAvatar state={currentStatus ?? 'thinking'} size={40} />
                    <Text className="text-text-secondary ml-sm text-sm">
                        {getStatusText()}
                    </Text>
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
                    editable={!isLoading}
                />
                <TouchableOpacity
                    className={`w-10 h-10 rounded-full justify-center items-center ${!inputText.trim() || isLoading ? 'bg-grey-medium' : 'bg-primary-darkest'
                        }`}
                    onPress={handleSend}
                    disabled={!inputText.trim() || isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <MaterialCommunityIcons name="send" size={20} color="#fff" />
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}
