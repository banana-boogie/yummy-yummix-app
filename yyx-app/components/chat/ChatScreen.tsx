import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
    Alert,
    View,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/common/Text';
import { IrmixyAvatar } from '@/components/chat/IrmixyAvatar';
import { TypingDots } from '@/components/chat/TypingIndicator';
import { ChatMessageItem } from '@/components/chat/ChatMessageItem';
import { ChatResumeBar } from '@/components/chat/ChatResumeBar';
import { ChatInputBar } from '@/components/chat/ChatInputBar';
import { useMessageStreaming } from '@/hooks/chat/useMessageStreaming';
import { useSmartScroll } from '@/hooks/chat/useSmartScroll';
import { useResumeSession } from '@/hooks/chat/useResumeSession';
import { useChatMessageActions } from '@/hooks/chat/useChatMessageActions';
import type { BudgetWarningPayload, ChatMessage, IrmixyStatus } from '@/services/chatService';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import i18n from '@/i18n';

const SCROLL_DELAY_MS = 100;

/** Statuses that indicate recipe generation/modification is in progress */
const isRecipeToolStatus = (status: IrmixyStatus): boolean =>
    status === 'cooking_it_up' || status === 'generating';

interface Props {
    sessionId?: string | null;
    onSessionCreated?: (sessionId: string) => void;
    messages?: ChatMessage[];
    onMessagesChange?: (messages: ChatMessage[]) => void;
    onOpenSessionsMenu?: () => void;
    newChatSignal?: number;
}

const keyExtractor = (item: ChatMessage) => item.id;

export function ChatScreen({
    sessionId: initialSessionId,
    onSessionCreated,
    messages: externalMessages,
    onMessagesChange,
    onOpenSessionsMenu,
    newChatSignal,
}: Props) {
    const { user } = useAuth();
    const { language } = useLanguage();
    const queryClient = useQueryClient();
    const insets = useSafeAreaInsets();

    // --- Message state (lifted or local) ---
    const [internalMessages, setInternalMessages] = useState<ChatMessage[]>([]);
    const messages = externalMessages ?? internalMessages;

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

    const [currentSessionId, setCurrentSessionId] = useState<string | null>(initialSessionId ?? null);
    const [resumeDismissed, setResumeDismissed] = useState(false);
    const prevNewChatSignalRef = useRef<number | undefined>(newChatSignal);

    // Shared ref between scroll and streaming hooks
    const hasRecipeInCurrentStreamRef = useRef(false);

    // --- Scroll hook (called first — provides refs to streaming hook) ---
    const {
        flatListRef,
        showScrollButton,
        scrollToEndThrottled,
        handleContentSizeChange,
        handleLayout,
        handleScroll,
        handleScrollToEnd,
        isNearBottomRef,
        skipNextScrollToEndRef,
    } = useSmartScroll({
        hasRecipeInCurrentStreamRef,
    });

    // --- Resume session hook ---
    const {
        resumeSession,
        setResumeSession,
        handleResumeContinue,
        handleResumeDismiss,
    } = useResumeSession({
        user,
        initialSessionId,
        currentSessionId,
        setCurrentSessionId,
        messagesLength: messages.length,
        setMessages,
        onSessionCreated,
        resumeDismissed,
        setResumeDismissed,
    });

    const onResumeSessionClear = useCallback(() => {
        if (resumeSession) {
            setResumeSession(null);
        }
    }, [resumeSession, setResumeSession]);

    // --- Budget state ---
    const [isBudgetExceeded, setIsBudgetExceeded] = useState(false);

    const handleBudgetWarning = useCallback((warning: BudgetWarningPayload) => {
        Alert.alert(
            i18n.t('chat.budget.warningTitle'),
            i18n.t('chat.budget.warningDetailed', {
                usedUsd: warning.usedUsd.toFixed(4),
                budgetUsd: warning.budgetUsd.toFixed(2),
            }),
        );
    }, []);

    const handleBudgetExceeded = useCallback(() => {
        setIsBudgetExceeded(true);
        Alert.alert(
            i18n.t('chat.budget.exceededTitle'),
            i18n.t('chat.budget.exceededMessage'),
        );
    }, []);

    // --- Speech recognition (uses a ref-based callback to avoid stale closure) ---
    const setInputTextRef = useRef<(text: string) => void>(() => {});
    const { isListening, pulseAnim, handleMicPress, stopAndGuard } = useSpeechRecognition({
        language,
        onTranscript: useCallback((text: string) => setInputTextRef.current(text), []),
    });

    // --- Streaming hook (core chat logic) ---
    const {
        inputText,
        setInputText,
        isLoading,
        isStreaming,
        isRecipeGenerating,
        currentStatus,
        handleSend,
        resetStreamingState,
    } = useMessageStreaming({
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
        onBudgetWarning: handleBudgetWarning,
        onBudgetExceeded: handleBudgetExceeded,
    });

    // Wire speech recognition to streaming hook's setInputText
    setInputTextRef.current = setInputText;

    // --- Message actions hook ---
    const {
        handleCopyMessage,
        handleStartCooking,
        handleActionPress,
    } = useChatMessageActions({
        setMessages,
        queryClient,
    });

    // --- Effects ---

    // Sync currentSessionId when parent changes it
    useEffect(() => {
        const nextSessionId = initialSessionId ?? null;
        if (nextSessionId !== currentSessionId) {
            resetStreamingState();
            setCurrentSessionId(nextSessionId);
            if (nextSessionId) {
                setResumeSession(null);
            }
        }
    }, [initialSessionId, currentSessionId, resetStreamingState, setCurrentSessionId, setResumeSession]);

    // Hide resume prompt when parent explicitly starts a new chat
    useEffect(() => {
        if (
            newChatSignal !== undefined &&
            prevNewChatSignalRef.current !== undefined &&
            newChatSignal !== prevNewChatSignalRef.current
        ) {
            setResumeSession(null);
            setResumeDismissed(true);
        }
        prevNewChatSignalRef.current = newChatSignal;
    }, [newChatSignal, setResumeSession]);

    // Scroll to bottom when recipe tracker appears
    useEffect(() => {
        if (isRecipeToolStatus(currentStatus)) {
            setTimeout(() => {
                scrollToEndThrottled(true);
            }, SCROLL_DELAY_MS);
        }
    }, [currentStatus, scrollToEndThrottled]);

    // --- Derived state ---

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

    const handleStop = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        resetStreamingState();
    }, [resetStreamingState]);

    const lastMessageId = messages.length > 0 ? messages[messages.length - 1]?.id : null;
    const statusText = useMemo(() => getStatusText(), [getStatusText]);

    const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    const showRecipeTracker = isRecipeGenerating && !latestMessage?.customRecipe;

    const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
        const isLast = item.id === lastMessageId;
        return (
            <ChatMessageItem
                item={item}
                isLastMessage={isLast}
                isLoading={isLast ? isLoading : false}
                isRecipeGenerating={isLast ? isRecipeGenerating : false}
                currentStatus={isLast ? currentStatus : null}
                statusText={isLast ? statusText : ''}
                onCopyMessage={handleCopyMessage}
                onStartCooking={handleStartCooking}
                onActionPress={handleActionPress}
            />
        );
    }, [lastMessageId, isLoading, isRecipeGenerating, currentStatus, statusText, handleCopyMessage, handleStartCooking, handleActionPress]);

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
          <View className="flex-1 w-full self-center max-w-[500px] md:max-w-[700px] lg:max-w-[800px]">
            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={keyExtractor}
                contentContainerStyle={{ padding: 16, flexGrow: 1 }}
                ListHeaderComponent={
                    resumeSession && !resumeDismissed && messages.length === 0 && !currentSessionId ? (
                        <ChatResumeBar
                            sessionTitle={resumeSession.title}
                            onContinue={handleResumeContinue}
                            onDismiss={handleResumeDismiss}
                        />
                    ) : null
                }
                onContentSizeChange={handleContentSizeChange}
                onLayout={handleLayout}
                onScroll={handleScroll}
                scrollEventThrottle={200}
                removeClippedSubviews={Platform.OS !== 'web'}
                maxToRenderPerBatch={3}
                updateCellsBatchingPeriod={50}
                windowSize={5}
                initialNumToRender={8}
                getItemLayout={undefined}
                onScrollToIndexFailed={(info) => {
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
                    onPress={handleScrollToEnd}
                    className="absolute right-4 bottom-40 z-50 bg-primary-default rounded-full p-3 shadow-lg"
                    style={{ elevation: 4 }}
                >
                    <MaterialCommunityIcons name="chevron-double-down" size={24} color="white" />
                </TouchableOpacity>
            )}

            {/* Status indicator with avatar (hidden when recipe tracker is visible) */}
            {isLoading && !showRecipeTracker && (
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
                disabled={isBudgetExceeded}
                disabledMessage={isBudgetExceeded ? i18n.t('chat.budget.upgradeHint') : undefined}
            />
          </View>
        </KeyboardAvoidingView>
    );
}
