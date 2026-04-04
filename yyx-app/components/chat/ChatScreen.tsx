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

import { ChatInputBar } from '@/components/chat/ChatInputBar';
import { SPACING , COLORS } from '@/constants/design-tokens';
import { useMessageStreaming } from '@/hooks/chat/useMessageStreaming';
import { useSmartScroll } from '@/hooks/chat/useSmartScroll';

import { useChatMessageActions } from '@/hooks/chat/useChatMessageActions';
import {
    executeAction,
    type ActionContext,
} from '@/services/actions/actionRegistry';
import type { Action, IrmixyResponse } from '@/types/irmixy';
import { isRecipeToolStatus } from '@/services/chatService';
import type { BudgetWarningPayload, ChatMessage } from '@/services/chatService';
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
const CHAT_CONTENT_STYLE = { padding: SPACING.md, flexGrow: 1 };

interface Props {
    sessionId?: string | null;
    onSessionCreated?: (sessionId: string) => void;
    messages?: ChatMessage[];
    onMessagesChange?: (messages: ChatMessage[]) => void;
    onOpenSessionsMenu?: () => void;
    newChatSignal?: number;
    /** Structured cooking context — sent as a separate field to the backend */
    cookingContext?: import('@/types/irmixy').CookingContext;
    /** Override the cycling greeting shown in the empty state */
    emptyStateGreeting?: string;
    /** Injected as the first assistant message (renders as a chat bubble from Irmixy) */
    initialGreeting?: string;
    /** Called before navigating away (e.g. "Start Cooking" inside a modal) */
    onNavigateAway?: () => void;
    /** Override the keyboard avoiding offset (e.g. when embedded in a modal with its own header) */
    keyboardVerticalOffset?: number;
    /** Minimum bottom inset for ChatInputBar (e.g. when safe area reports 0 inside a pageSheet modal) */
    minBottomInset?: number;
}

const keyExtractor = (item: ChatMessage) => item.id;

export function ChatScreen({
    sessionId: initialSessionId,
    onSessionCreated,
    messages: externalMessages,
    onMessagesChange,
    onOpenSessionsMenu,
    newChatSignal,
    cookingContext,
    emptyStateGreeting,
    initialGreeting,
    onNavigateAway,
    keyboardVerticalOffset,
    minBottomInset,
}: Props) {
    const { user } = useAuth();
    const { locale } = useLanguage();
    const { userProfile } = useUserProfile();
    const queryClient = useQueryClient();
    const insets = useSafeAreaInsets();

    // --- Message state ---
    // Always use internal state for rendering. When onMessagesChange is provided,
    // also sync to external store (e.g. context ref) for persistence.
    // Initialize from externalMessages if provided.
    const [internalMessages, setInternalMessages] = useState<ChatMessage[]>(
        () => externalMessages ?? [],
    );
    const messages = internalMessages;

    const messagesRef = useRef<ChatMessage[]>(messages);
    messagesRef.current = messages;

    // Track whether the last message update originated internally (streaming, user send)
    // to avoid infinite loops when syncing external→internal.
    const internalWriteRef = useRef(false);

    const setMessages = useCallback((update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
        const newMessages = typeof update === 'function' ? update(messagesRef.current) : update;
        // Sync ref immediately so rapid successive calls (e.g. stream chunk flushes)
        // read the latest state even before React re-renders.
        messagesRef.current = newMessages;
        internalWriteRef.current = true;
        setInternalMessages(newMessages);
        // Also sync to external store for persistence (e.g. across step navigation)
        onMessagesChange?.(newMessages);
    }, [onMessagesChange]);

    // Sync parent-driven message changes (session selection, New Chat) into internal state.
    // Skips when the change originated from our own setMessages to avoid loops.
    // Uses length + last-ID check instead of referential equality to avoid unnecessary
    // re-renders when the parent creates a new array with identical content.
    useEffect(() => {
        if (internalWriteRef.current) {
            internalWriteRef.current = false;
            return;
        }
        const incoming = externalMessages ?? [];
        const current = messagesRef.current;
        const changed = incoming.length !== current.length
            || incoming[incoming.length - 1]?.id !== current[current.length - 1]?.id;
        if (changed) {
            messagesRef.current = incoming;
            setInternalMessages(incoming);
        }
    }, [externalMessages]);  

    const [currentSessionId, setCurrentSessionId] = useState<string | null>(initialSessionId ?? null);
    // Track session IDs created by this ChatScreen instance to avoid
    // resetting the stream when the ID round-trips through a parent context.
    const ownSessionIdRef = useRef<string | null>(null);
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
        onSessionCreated: useCallback((sessionId: string) => {
            ownSessionIdRef.current = sessionId;
            onSessionCreated?.(sessionId);
        }, [onSessionCreated]),
        stopAndGuard,
        scrollToEndThrottled,
        isNearBottomRef,
        skipNextScrollToEndRef,
        hasRecipeInCurrentStreamRef,
        flatListRef,
        onBudgetWarning: handleBudgetWarning,
        onBudgetExceeded: handleBudgetExceeded,
        cookingContext,
        onActionsReceived: useCallback((actions: Action[], response: IrmixyResponse) => {
            const autoActions = actions.filter((a) => a.autoExecute);
            if (autoActions.length === 0) return;
            // Build context from the response itself, not from stale messagesRef
            const context: ActionContext = {
                currentRecipe: response.customRecipe,
                recipes: response.recipes,
            };
            const hasContext = !!context.currentRecipe || !!context.recipes?.length;
            for (const action of autoActions) {
                executeAction(action, hasContext ? context : undefined, { source: 'auto', path: 'text' });
            }
        }, []),
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
        getMessages: useCallback(() => messagesRef.current, []),
        onNavigateAway,
        chatSessionId: currentSessionId,
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

    // --- Compute effective messages with initial greeting (synchronous — no flash of empty state) ---
    const greetingDateRef = useRef(new Date());
    // Seed the initial greeting as a real message so it persists alongside
    // user messages instead of disappearing when the first message is sent.
    const greetingSeededRef = useRef(false);
    useEffect(() => {
        if (initialGreeting && messages.length === 0 && !greetingSeededRef.current) {
            greetingSeededRef.current = true;
            setMessages([{
                id: 'initial-greeting',
                role: 'assistant' as const,
                content: initialGreeting,
                createdAt: greetingDateRef.current,
            }]);
        }
    }, [initialGreeting]); // eslint-disable-line react-hooks/exhaustive-deps

    const effectiveMessages = messages;

    // --- Effects ---

    // Sync currentSessionId when parent changes it (e.g. session selection).
    // Only reset when the parent provides a DIFFERENT non-null session.
    // Skip when: parent is null (session not yet propagated), or the ID
    // was created by this instance (round-trip through context).
    useEffect(() => {
        const nextSessionId = initialSessionId ?? null;
        // Don't reset if parent hasn't provided a session yet — our internal
        // session creation is authoritative until the parent catches up.
        if (!nextSessionId) return;
        // Don't reset if this is the same session we created
        if (nextSessionId === ownSessionIdRef.current) return;
        // Don't reset if already on this session
        if (nextSessionId === currentSessionId) return;
        // Parent switched to a genuinely different session — reset and sync
        resetStreamingState();
        setCurrentSessionId(nextSessionId);
        setIsBudgetExceeded(false);
        budgetWarningShownRef.current = false;
    }, [initialSessionId, currentSessionId, resetStreamingState, setCurrentSessionId]);

    // Reset budget state when parent explicitly starts a new chat
    useEffect(() => {
        if (
            newChatSignal !== undefined &&
            prevNewChatSignalRef.current !== undefined &&
            newChatSignal !== prevNewChatSignalRef.current
        ) {
            setIsBudgetExceeded(false);
            budgetWarningShownRef.current = false;
        }
        prevNewChatSignalRef.current = newChatSignal;
    }, [newChatSignal]);

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

    const lastMessageId = effectiveMessages.length > 0 ? effectiveMessages[effectiveMessages.length - 1]?.id : null;
    const statusText = useMemo(() => getStatusText(), [getStatusText]);

    const latestMessage = effectiveMessages.length > 0 ? effectiveMessages[effectiveMessages.length - 1] : null;
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
            keyboardVerticalOffset={keyboardVerticalOffset ?? (insets.top + 60)}
        >
          <View className="flex-1 w-full self-center max-w-[500px] md:max-w-[700px] lg:max-w-[800px]">
            <FlatList
                ref={flatListRef}
                data={effectiveMessages}
                renderItem={renderMessage}
                keyExtractor={keyExtractor}
                contentContainerStyle={CHAT_CONTENT_STYLE}
                onContentSizeChange={handleContentSizeChange}
                onLayout={handleLayout}
                onScroll={handleScroll}
                scrollEventThrottle={200}
                removeClippedSubviews={Platform.OS !== 'web'}
                maxToRenderPerBatch={8}
                updateCellsBatchingPeriod={50}
                windowSize={7}
                initialNumToRender={10}
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
                    <View className="flex-1 justify-center items-center">
                        <View className="mb-md mx-lg bg-primary-lightest rounded-xl px-md py-sm" style={{ maxWidth: 300 }}>
                            <Text className="text-text-default text-center text-base">
                                {emptyStateGreeting ?? currentGreeting}
                            </Text>
                        </View>
                        <Image
                            source={require('@/assets/images/irmixy-avatar/irmixy-with-book.png')}
                            style={{ width: 240, height: 240 }}
                            contentFit="contain"
                        />
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
                    <MaterialCommunityIcons name="chevron-double-down" size={24} color={COLORS.neutral.white} />
                </TouchableOpacity>
            )}

            {/* Inline status indicator (hidden during recipe tracker) */}
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
                bottomInset={Math.max(insets.bottom, minBottomInset ?? 0)}
                disabled={isBudgetExceeded}
                disabledMessage={isBudgetExceeded ? i18n.t('chat.budget.upgradeHint') : undefined}
            />
          </View>
        </KeyboardAvoidingView>
    );
}
