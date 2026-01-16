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
import { sendChatMessage, ChatMessage } from '@/services/chatService';
import { useAuth } from '@/contexts/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import i18n from '@/i18n';

interface Props {
    sessionId?: string | null;
    onSessionCreated?: (sessionId: string) => void;
}

export function ChatScreen({ sessionId: initialSessionId, onSessionCreated }: Props) {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const flatListRef = useRef<FlatList>(null);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(initialSessionId ?? null);

    // Get initial suggestions from i18n
    const initialSuggestions = useMemo(() => [
        i18n.t('chat.suggestions.suggestRecipe'),
        i18n.t('chat.suggestions.whatCanICook'),
        i18n.t('chat.suggestions.quickMeal'),
        i18n.t('chat.suggestions.ingredientsIHave'),
        i18n.t('chat.suggestions.healthyOptions'),
    ], []);

    // Show suggestions only when chat is empty or after AI response
    const showSuggestions = messages.length === 0 ||
        (messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && !isLoading);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages.length]);

    const handleSendMessage = useCallback(async (messageText: string) => {
        if (!messageText.trim() || isLoading || !user) return;

        const userMessage: ChatMessage = {
            id: `temp-${Date.now()}`,
            role: 'user',
            content: messageText.trim(),
            createdAt: new Date(),
        };

        const assistantMessageId = `assistant-${Date.now()}`;

        // Add user message and empty assistant message for streaming
        setMessages(prev => [
            ...prev,
            userMessage,
            {
                id: assistantMessageId,
                role: 'assistant',
                content: '',
                createdAt: new Date(),
            },
        ]);
        setInputText('');
        setIsLoading(true);

        try {
            // Import stream function
            const { streamChatMessage } = await import('@/services/chatService');

            // Stream the response
            await streamChatMessage(
                userMessage.content,
                currentSessionId,
                // onChunk - append content progressively
                (chunk) => {
                    setMessages(prev => {
                        const updated = [...prev];
                        const lastIdx = updated.findIndex(m => m.id === assistantMessageId);
                        if (lastIdx !== -1) {
                            updated[lastIdx] = {
                                ...updated[lastIdx],
                                content: updated[lastIdx].content + chunk,
                            };
                        }
                        return updated;
                    });
                },
                // onSessionId
                (sessionId) => {
                    if (!currentSessionId) {
                        setCurrentSessionId(sessionId);
                        onSessionCreated?.(sessionId);
                    }
                }
            );
        } catch (error) {
            // Replace streaming message with error
            setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.findIndex(m => m.id === assistantMessageId);
                if (lastIdx !== -1) {
                    updated[lastIdx] = {
                        ...updated[lastIdx],
                        content: updated[lastIdx].content || i18n.t('chat.error'),
                    };
                }
                return updated;
            });
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, user, currentSessionId, onSessionCreated]);

    const handleSend = useCallback(() => {
        handleSendMessage(inputText);
    }, [inputText, handleSendMessage]);

    const handleSuggestionSelect = useCallback((suggestion: string) => {
        handleSendMessage(suggestion);
    }, [handleSendMessage]);

    const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
        const isUser = item.role === 'user';
        return (
            <View
                className={`max-w-[80%] p-sm rounded-lg mb-sm ${isUser ? 'self-end bg-primary-default' : 'self-start bg-background-secondary'
                    }`}
            >
                <Text className={`text-base leading-relaxed ${isUser ? 'text-white' : 'text-text-primary'}`}>
                    {item.content}
                </Text>
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

            {/* Suggestion chips above input */}
            {showSuggestions && (
                <SuggestionChips
                    suggestions={initialSuggestions}
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
