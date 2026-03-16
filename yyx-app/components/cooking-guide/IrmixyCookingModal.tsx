/**
 * IrmixyCookingModal — Full-screen modal chat for asking Irmixy questions
 * while cooking. Opens from the AskIrmixyButton in the cooking guide footer.
 *
 * Uses a lightweight chat interface with recipe context passed to the
 * orchestrator so Irmixy knows which recipe/step the user is on.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    Modal,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '@/components/common/Text';
import { ChatInputBar } from '@/components/chat/ChatInputBar';
import { ChatMessageItem } from '@/components/chat/ChatMessageItem';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { sendMessage } from '@/services/chatService';
import type { ChatMessage } from '@/services/chatService';
import { COLORS, SPACING } from '@/constants/design-tokens';
import i18n from '@/i18n';

interface IrmixyCookingModalProps {
    visible: boolean;
    onClose: () => void;
    recipeId: string;
    recipeName: string;
    currentStep: number;
    totalSteps: number;
    stepInstruction?: string;
}

const keyExtractor = (item: ChatMessage) => item.id;

export function IrmixyCookingModal({
    visible,
    onClose,
    recipeId,
    recipeName,
    currentStep,
    totalSteps,
    stepInstruction,
}: IrmixyCookingModalProps) {
    const insets = useSafeAreaInsets();
    const { locale } = useLanguage();
    const { user } = useAuth();
    const flatListRef = useRef<FlatList>(null);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const streamCancelRef = useRef<(() => void) | null>(null);

    // Speech recognition
    const setInputTextRef = useRef<(text: string) => void>(() => {});
    const { isListening, pulseAnim, handleMicPress, stopAndGuard } = useSpeechRecognition({
        locale,
        onTranscript: useCallback((text: string) => setInputTextRef.current(text), []),
    });
    setInputTextRef.current = setInputText;

    // Reset state when modal opens
    useEffect(() => {
        if (visible) {
            setMessages([]);
            setInputText('');
            setIsLoading(false);
            setSessionId(null);
        }
    }, [visible]);

    const handleSend = useCallback(() => {
        const text = inputText.trim();
        if (!text || isLoading || !user) return;

        stopAndGuard();

        // Add user message
        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: text,
            createdAt: new Date(),
        };

        // Add placeholder assistant message
        const assistantId = `assistant-${Date.now()}`;
        const assistantMessage: ChatMessage = {
            id: assistantId,
            role: 'assistant',
            content: '',
            createdAt: new Date(),
        };

        setMessages(prev => [...prev, userMessage, assistantMessage]);
        setInputText('');
        setIsLoading(true);

        // Build message with cooking context prefix
        const contextPrefix = `[Cooking context: "${recipeName}", step ${currentStep}/${totalSteps}` +
            (stepInstruction ? `. Current step: "${stepInstruction}"` : '') + '] ';

        const handle = sendMessage(
            contextPrefix + text,
            sessionId,
            // onChunk
            (chunk: string) => {
                setMessages(prev =>
                    prev.map(m =>
                        m.id === assistantId
                            ? { ...m, content: m.content + chunk }
                            : m,
                    ),
                );
            },
            // onSessionId
            (newSessionId: string) => {
                setSessionId(newSessionId);
            },
            // onStatus
            undefined,
            // onStreamComplete
            () => {
                setIsLoading(false);
                streamCancelRef.current = null;
            },
        );

        streamCancelRef.current = handle.cancel;

        handle.done.catch(() => {
            setIsLoading(false);
            setMessages(prev =>
                prev.map(m =>
                    m.id === assistantId && !m.content
                        ? { ...m, content: i18n.t('chat.error.default') }
                        : m,
                ),
            );
        });

        setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
    }, [inputText, isLoading, user, sessionId, recipeName, currentStep, totalSteps, stepInstruction, stopAndGuard]);

    const handleStop = useCallback(() => {
        streamCancelRef.current?.();
        streamCancelRef.current = null;
        setIsLoading(false);
    }, []);

    const renderMessage = useCallback(({ item }: { item: ChatMessage }) => (
        <ChatMessageItem
            item={item}
            isLastMessage={false}
            isLoading={false}
            isRecipeGenerating={false}
            currentStatus={null}
            statusText=""
            showAvatar={false}
        />
    ), []);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                className="flex-1 bg-background-default"
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                {/* Header */}
                <View
                    className="flex-row items-center justify-between border-b border-border-default bg-background-default"
                    style={{ paddingTop: insets.top + SPACING.xs, paddingBottom: SPACING.sm, paddingHorizontal: SPACING.md }}
                >
                    <View className="flex-row items-center flex-1">
                        <Image
                            source={require('@/assets/images/irmixy-avatar/irmixy-face.png')}
                            style={{ width: 32, height: 32, borderRadius: 16 }}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                        />
                        <View className="ml-sm flex-1">
                            <Text className="font-semibold text-text-primary">Irmixy</Text>
                            <Text className="text-xs text-text-secondary" numberOfLines={1}>
                                {i18n.t('chat.cookingModal.contextHint', {
                                    recipeName,
                                    step: currentStep,
                                    total: totalSteps,
                                })}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={onClose}
                        className="w-10 h-10 items-center justify-center"
                        accessibilityLabel="Close"
                        accessibilityRole="button"
                    >
                        <MaterialCommunityIcons name="close" size={24} color={COLORS.text.secondary} />
                    </TouchableOpacity>
                </View>

                {/* Messages */}
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={{ padding: 16, flexGrow: 1 }}
                    ListEmptyComponent={
                        <View className="flex-1 justify-center items-center pt-xxxl">
                            <Image
                                source={require('@/assets/images/irmixy-avatar/irmixy-face.png')}
                                style={{ width: 80, height: 80, borderRadius: 40 }}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                            />
                            <View className="mt-md bg-primary-lightest rounded-xl px-md py-sm" style={{ maxWidth: 260 }}>
                                <Text className="text-text-primary text-center text-base">
                                    {i18n.t('chat.cookingModal.greeting')}
                                </Text>
                            </View>
                        </View>
                    }
                    onContentSizeChange={() => {
                        if (messages.length > 0) {
                            flatListRef.current?.scrollToEnd({ animated: true });
                        }
                    }}
                />

                {/* Input */}
                <ChatInputBar
                    inputText={inputText}
                    setInputText={setInputText}
                    isLoading={isLoading}
                    isListening={isListening}
                    handleMicPress={handleMicPress}
                    handleSend={handleSend}
                    handleStop={handleStop}
                    pulseAnim={pulseAnim}
                    bottomInset={insets.bottom}
                />
            </KeyboardAvoidingView>
        </Modal>
    );
}
