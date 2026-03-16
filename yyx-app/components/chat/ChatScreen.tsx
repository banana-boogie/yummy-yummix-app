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
import { SearchingAnimation } from '@/components/chat/SearchingAnimation';
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
import { useUserProfile } from '@/contexts/UserProfileContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import i18n from '@/i18n';
import { chat as chatEn } from '@/i18n/locales/en/chat';
import { chat as chatEs } from '@/i18n/locales/es/chat';

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
    const { locale } = useLanguage();
    const { userProfile } = useUserProfile();
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
    const budgetWarningShownRef = useRef(false);

    const handleBudgetWarning = useCallback((_warning: BudgetWarningPayload) => {
        if (budgetWarningShownRef.current) return;
        budgetWarningShownRef.current = true;

        // Inject a warm Irmixy chat message instead of a system Alert
        const warningMessage: ChatMessage = {
            id: `budget-warning-${Date.now()}`,
            role: 'assistant',
            content: i18n.t('chat.budget.warmWarning'),
            createdAt: new Date(),
        };
        setMessages((prev) => [...prev, warningMessage]);
    }, [setMessages]);

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
        locale,
        onTranscript: useCallback((text: string) => setInputTextRef.current(text), []),
    });

    // --- Streaming hook (core chat logic) ---
    const {
        inputText,
        setInputText,
        isLoading,
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

    // --- Cycling greeting for empty state ---
    // Access greeting arrays directly (i18n-js doesn't support returnObjects)
    const greetingLocale = locale.startsWith('es') ? chatEs : chatEn;
    const greetingKey = userProfile?.name ? 'withName' : 'withoutName';
    const greetingList = greetingLocale.greetingCycling[greetingKey];
    const [greetingIndex, setGreetingIndex] = useState(() => Math.floor(Math.random() * greetingList.length));

    useEffect(() => {
        const interval = setInterval(() => {
            setGreetingIndex((prev) => (prev + 1) % greetingList.length);
        }, 6000);
        return () => clearInterval(interval);
    }, [greetingList.length]);

    const currentGreeting = useMemo(() => {
        const raw = greetingList[greetingIndex] || i18n.t('chat.greeting');
        return userProfile?.name ? raw.replace('{{name}}', userProfile.name) : raw;
    }, [greetingIndex, greetingList, userProfile?.name]);

    // --- Effects ---

    // Sync currentSessionId when parent changes it
    useEffect(() => {
        const nextSessionId = initialSessionId ?? null;
        if (nextSessionId !== currentSessionId) {
            resetStreamingState();
            setCurrentSessionId(nextSessionId);
            setIsBudgetExceeded(false);
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
            setIsBudgetExceeded(false);
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
                showAvatar
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
                            style={{ width: 180, height: 180 }}
                            contentFit="contain"
                        />
                        <View className="mt-md mx-lg bg-primary-lightest rounded-xl px-md py-sm" style={{ maxWidth: 300 }}>
                            <Text className="text-text-primary text-center text-base">
                                {currentGreeting}
                            </Text>
                        </View>
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

            {/* Prominent centered animation for recipe search */}
            {isLoading && !showRecipeTracker && currentStatus === 'searching' && (
                <SearchingAnimation />
            )}

            {/* Inline status indicator for other statuses (hidden during search + recipe tracker) */}
            {isLoading && !showRecipeTracker && currentStatus !== 'searching' && (
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
