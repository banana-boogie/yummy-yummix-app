import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View,
    Alert,
    FlatList,
    Platform,
    TouchableOpacity,
    type NativeSyntheticEvent,
    type NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Text } from '@/components/common/Text';
import { IrmixyAvatar, AvatarState } from './IrmixyAvatar';
import { VoiceButton } from './VoiceButton';
import { ChatMessageItem } from '@/components/chat/ChatMessageItem';
import { RecipeProgressTracker } from './RecipeProgressTracker';
import { VoiceToolLoader } from './VoiceToolLoader';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { useAuth } from '@/contexts/AuthContext';
import { customRecipeService } from '@/services/customRecipeService';
import type { QuotaInfo, VoiceStatus } from '@/services/voice/types';
import type { ChatMessage, IrmixyStatus } from '@/services/chatService';
import type { Action, GeneratedRecipe } from '@/types/irmixy';
import i18n from '@/i18n';
import { getChatCustomCookingGuidePath } from '@/utils/navigation/recipeRoutes';
import {
    executeAction,
    resolveActionContext,
    type ActionContextSource,
} from '@/services/actions/actionRegistry';

const SCROLL_THRESHOLD = 600; // Large enough to accommodate recipe cards (~400px tall)
const LIST_CONTENT_STYLE = { paddingVertical: 8 };
const STOP_BUTTON_STYLE = { paddingHorizontal: 20, paddingVertical: 10, minHeight: 44 };

interface Props {
    sessionId?: string | null;
    onSessionCreated?: (sessionId: string) => void;
    /** External transcript messages for mode-switch persistence */
    transcriptMessages?: ChatMessage[];
    onTranscriptChange?: (messages: ChatMessage[]) => void;
}

export function VoiceChatScreen({
    sessionId: initialSessionId,
    onSessionCreated,
    transcriptMessages: externalMessages,
    onTranscriptChange,
}: Props) {
    const { user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [duration, setDuration] = useState(0);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const isNearBottomRef = useRef(true);

    const {
        status,
        error,
        quotaInfo,
        transcriptMessages,
        isExecutingTool,
        executingToolName,
        updateMessage,
        startConversation,
        stopConversation,
    } = useVoiceChat({
        sessionId: initialSessionId,
        initialTranscriptMessages: externalMessages,
        onTranscriptChange,
        onQuotaWarning: (info: QuotaInfo) => {
            Alert.alert(
                i18n.t('chat.voice.quotaWarningTitle'),
                i18n.t('chat.voice.quotaWarning', { minutes: info.remainingMinutes.toFixed(1) }),
                [{ text: i18n.t('common.ok') }],
            );
        },
    });

    const hasMessages = transcriptMessages.length > 0;
    const isConnected = status !== 'idle' && status !== 'error';
    const isConnecting = status === 'connecting';
    const isActive = isConnected && !isConnecting;
    const currentStatus: IrmixyStatus = isExecutingTool ? 'generating' : null;
    const statusText = isExecutingTool ? i18n.t('chat.voice.executingTool') : '';
    const lastMessageId = hasMessages ? transcriptMessages[transcriptMessages.length - 1]?.id : null;

    // Refs for volatile values to keep renderMessage callback stable
    const lastMessageIdRef = useRef(lastMessageId);
    lastMessageIdRef.current = lastMessageId;
    const currentStatusRef = useRef(currentStatus);
    currentStatusRef.current = currentStatus;
    const isExecutingToolRef = useRef(isExecutingTool);
    isExecutingToolRef.current = isExecutingTool;
    const statusTextRef = useRef(statusText);
    statusTextRef.current = statusText;

    const isRecipeGeneratingRef = useRef(false);
    isRecipeGeneratingRef.current = isExecutingTool && executingToolName === 'generate_custom_recipe';

    // lastMessageId and isExecutingTool trigger list re-renders so the last
    // message's isLoading prop stays current. Other tool state is read from refs.
    const extraData = useMemo(() => ({ lastMessageId, isExecutingTool }), [lastMessageId, isExecutingTool]);

    const getAvatarState = (voiceStatus: VoiceStatus): AvatarState => {
        switch (voiceStatus) {
            case 'connecting':
                return 'thinking';
            case 'listening':
                return 'listening';
            case 'processing':
                return 'thinking';
            case 'speaking':
                return 'speaking';
            case 'error':
                return 'idle';
            default:
                return 'idle';
        }
    };

    const getStatusText = useCallback((voiceStatus: VoiceStatus) => {
        switch (voiceStatus) {
            case 'listening':
                return i18n.t('chat.voice.listening');
            case 'connecting':
                return i18n.t('chat.voice.connecting');
            case 'processing':
                return i18n.t('chat.voice.thinking');
            case 'speaking':
                return i18n.t('chat.voice.speaking');
            case 'error':
                return i18n.t('common.errors.title');
            default:
                return i18n.t('chat.voice.tapToSpeak');
        }
    }, []);

    // Ref-stabilize stopConversation to avoid stale closure in useFocusEffect
    const stopConversationRef = useRef(stopConversation);
    useEffect(() => { stopConversationRef.current = stopConversation; }, [stopConversation]);

    // Stop voice when navigating away from this screen
    useFocusEffect(
        useCallback(() => {
            return () => {
                stopConversationRef.current();
            };
        }, [])
    );

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isActive) {
            interval = setInterval(() => setDuration(d => d + 1), 1000);
        } else if (!isConnected) {
            setDuration(0);
        }
        return () => clearInterval(interval);
    }, [isActive, isConnected]);

    // Scroll so the latest message's top is visible at the top of the viewport.
    // Used both for new messages during active session and when loading saved sessions.
    const scrollToLastMessage = useCallback((animated = true) => {
        const count = transcriptMessages.length;
        if (count === 0) return;
        setTimeout(() => {
            flatListRef.current?.scrollToIndex({
                index: count - 1,
                viewPosition: 0, // align item top to viewport top
                animated,
            });
        }, 150);
    }, [transcriptMessages.length]);

    // Auto-scroll when new messages arrive during active voice session
    const prevMessageCountRef = useRef(transcriptMessages.length);
    useEffect(() => {
        const prevCount = prevMessageCountRef.current;
        prevMessageCountRef.current = transcriptMessages.length;
        if (isActive && transcriptMessages.length > prevCount) {
            scrollToLastMessage();
        }
    }, [transcriptMessages.length, isActive, scrollToLastMessage]);

    // Scroll to bottom when loading a saved session.
    // Uses scrollToEnd (not scrollToIndex) to avoid chunky rendering with windowed FlatList.
    // The pendingSessionScrollRef flag keeps re-scrolling as items render within a 1s window.
    const prevSessionIdRef = useRef(initialSessionId);
    const pendingSessionScrollRef = useRef(false);
    useEffect(() => {
        if (initialSessionId !== prevSessionIdRef.current) {
            prevSessionIdRef.current = initialSessionId;
            if (hasMessages && !isActive) {
                pendingSessionScrollRef.current = true;
                flatListRef.current?.scrollToEnd({ animated: false });
                setTimeout(() => { pendingSessionScrollRef.current = false; }, 1000);
            }
        }
    }, [initialSessionId, hasMessages, isActive]);

    useEffect(() => {
        if (error) {
            Alert.alert(i18n.t('common.errors.title'), error);
        }
    }, [error]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleVoicePress = async () => {
        if (quotaInfo && quotaInfo.remainingMinutes <= 0) {
            Alert.alert(i18n.t('chat.voice.quotaWarningTitle'), i18n.t('chat.voice.quotaExceeded'));
            return;
        }

        await startConversation();
    };

    const handleCopyMessage = useCallback(async (content: string) => {
        try {
            await Clipboard.setStringAsync(content);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (Platform.OS === 'ios') {
                Alert.alert(
                    i18n.t('common.copied'),
                    i18n.t('chat.messageCopied'),
                    [{ text: i18n.t('common.ok') }],
                    { userInterfaceStyle: 'automatic' },
                );
            } else {
                Alert.alert(i18n.t('common.copied'), i18n.t('chat.messageCopied'));
            }
        } catch (copyError) {
            if (__DEV__) console.error('[VoiceChatScreen] Failed to copy message:', copyError);
        }
    }, []);

    const handleStartCooking = useCallback(async (
        recipe: GeneratedRecipe,
        finalName: string,
        messageId: string,
        savedRecipeId?: string,
    ) => {
        try {
            let recipeId = savedRecipeId;
            if (!recipeId) {
                const { userRecipeId } = await customRecipeService.save(recipe, finalName);
                recipeId = userRecipeId;
                if (recipeId) {
                    updateMessage(messageId, { savedRecipeId: recipeId });
                }
            }

            if (recipeId) {
                router.push(getChatCustomCookingGuidePath(recipeId));
            }
        } catch (startCookingError) {
            console.error('[VoiceChatScreen] Start cooking error:', startCookingError);
            Alert.alert(i18n.t('common.errors.title'), i18n.t('common.errors.generic'));
        }
    }, [router, updateMessage]);

    const handleActionPress = useCallback((action: Action, messageId: string) => {
        const context = resolveActionContext(
            transcriptMessages as ActionContextSource[],
            messageId,
        );
        executeAction(action, context, { source: 'manual', path: 'voice' });
    }, [transcriptMessages]);

    const renderMessage = useCallback(({ item }: { item: ChatMessage }) => (
        <View className="px-md mb-sm">
            <ChatMessageItem
                item={item}
                isLastMessage={item.id === lastMessageIdRef.current}
                isLoading={isExecutingToolRef.current}
                isRecipeGenerating={item.id === lastMessageIdRef.current ? isRecipeGeneratingRef.current : false}
                currentStatus={currentStatusRef.current}
                statusText={statusTextRef.current}
                showAvatar
                onCopyMessage={handleCopyMessage}
                onStartCooking={handleStartCooking}
                onActionPress={handleActionPress}
            />
        </View>
    ), [handleActionPress, handleCopyMessage, handleStartCooking]);

    const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
        const isNearBottom = distanceFromBottom <= SCROLL_THRESHOLD;
        isNearBottomRef.current = isNearBottom;
        setShowScrollButton(!isNearBottom && contentSize.height > layoutMeasurement.height);
    }, []);

    const handleScrollToBottom = useCallback(() => {
        isNearBottomRef.current = true;
        setShowScrollButton(false);
        scrollToLastMessage();
    }, [scrollToLastMessage]);

    if (!user) {
        return (
            <View className="flex-1 justify-center items-center px-lg bg-background-default">
                <Text preset="body" className="text-text-secondary text-center">
                    {i18n.t('chat.loginRequired')}
                </Text>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-background-default" style={{ paddingBottom: isActive ? 0 : insets.bottom }}>
            {/* ── ACTIVE: status bar — Lupita-friendly with prominent stop button ── */}
            {isActive && (
                <View className="border-b border-border-default px-md py-md bg-background-default">
                    <View className="flex-row items-center justify-between">
                        {/* Left: avatar + status + timer */}
                        <View className="flex-row items-center gap-sm flex-1 mr-sm">
                            <IrmixyAvatar state={getAvatarState(status)} size={32} />
                            <View accessibilityLiveRegion="polite" className="flex-row items-center gap-xs flex-1">
                                <Text preset="bodySmall" className="text-text-default font-medium">
                                    {getStatusText(status)}
                                </Text>
                                <Text preset="caption" className="text-text-secondary">
                                    {formatDuration(duration)}
                                </Text>
                            </View>
                        </View>
                        {/* Right: prominent stop button (min 44px touch target) */}
                        <TouchableOpacity
                            onPress={stopConversation}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={i18n.t('chat.voice.stopRecording')}
                            className="flex-row items-center gap-sm bg-status-error rounded-full"
                            style={STOP_BUTTON_STYLE}
                        >
                            <Ionicons name="stop-circle" size={20} color="white" />
                            <Text preset="bodySmall" className="text-white font-bold">
                                {i18n.t('chat.voice.stop')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* ── Message list (active session OR viewing saved transcript) ── */}
            {(isActive || hasMessages) ? (
                <View className="flex-1">
                    <FlatList
                        ref={flatListRef}
                        data={transcriptMessages}
                        keyExtractor={item => item.id}
                        renderItem={renderMessage}
                        extraData={extraData}
                        contentContainerStyle={LIST_CONTENT_STYLE}
                        onScroll={handleScroll}
                        scrollEventThrottle={200}
                        showsVerticalScrollIndicator={false}
                        removeClippedSubviews={Platform.OS !== 'web'}
                        maxToRenderPerBatch={3}
                        updateCellsBatchingPeriod={50}
                        windowSize={5}
                        initialNumToRender={8}
                        onContentSizeChange={() => {
                            // Only auto-scroll for session loading. New-message scrolling
                            // is handled by the useEffect on transcriptMessages.length.
                            // Scrolling here for all size changes causes jumps when recipe
                            // cards expand/collapse (Show All / Show Less buttons).
                            if (pendingSessionScrollRef.current) {
                                flatListRef.current?.scrollToEnd({ animated: false });
                            }
                        }}
                        onScrollToIndexFailed={() => {
                            flatListRef.current?.scrollToEnd({ animated: false });
                        }}
                        ListFooterComponent={
                            isExecutingTool ? (
                                <VoiceToolLoader toolName={executingToolName} />
                            ) : (
                                <View className="py-sm" />
                            )
                        }
                    />

                    {/* Recipe progress tracker for recipe generation tool */}
                    {isExecutingTool && executingToolName === 'generate_custom_recipe' && (
                        <View className="px-md py-sm">
                            <RecipeProgressTracker
                                isActive={true}
                                hasRecipe={false}
                            />
                        </View>
                    )}
                </View>
            ) : (
                /* ── IDLE: big avatar centered (no messages, no active session) ── */
                <View className="flex-1 items-center justify-center px-lg">
                    <IrmixyAvatar state={getAvatarState(status)} size={120} />
                    <View className="mt-lg px-md">
                        <View accessibilityLiveRegion="polite">
                            <Text preset="body" className="text-text-secondary text-center">
                                {isConnecting
                                    ? i18n.t('chat.voice.connecting')
                                    : i18n.t('chat.voice.tapToSpeak')}
                            </Text>
                        </View>
                    </View>
                </View>
            )}

            {/* ── Scroll-to-bottom ── */}
            {(isActive || hasMessages) && showScrollButton && (
                <TouchableOpacity
                    onPress={handleScrollToBottom}
                    className="absolute right-4 bottom-4 z-50 bg-primary-default rounded-full p-3 shadow-lg"
                    style={{ elevation: 4 }}
                >
                    <MaterialCommunityIcons name="chevron-double-down" size={24} color="white" />
                </TouchableOpacity>
            )}

            {/* ── IDLE: bottom voice button ── */}
            {!isActive && !hasMessages && (
                <View className="items-center py-xl border-t border-grey-light bg-background-default">
                    <VoiceButton
                        state={isConnecting ? 'processing' : 'ready'}
                        onPress={handleVoicePress}
                        size={72}
                        disabled={isConnecting}
                        accessibilityLabel={i18n.t('chat.voice.tapToSpeak')}
                    />
                    {quotaInfo && !isConnected && (
                        <Text preset="caption" className="text-text-secondary mt-sm text-xs">
                            {i18n.t('chat.voice.minsRemaining', { mins: quotaInfo.remainingMinutes.toFixed(1) })}
                        </Text>
                    )}
                </View>
            )}

            {/* ── Compact mic bar when viewing saved transcript ── */}
            {!isActive && hasMessages && (
                <View className="items-center pt-lg pb-md border-t border-grey-light bg-background-default">
                    <VoiceButton
                        state={isConnecting ? 'processing' : 'ready'}
                        onPress={handleVoicePress}
                        size={64}
                        disabled={isConnecting}
                        accessibilityLabel={i18n.t('chat.voice.tapToSpeak')}
                    />
                    <Text preset="body" className="text-text-secondary mt-sm">
                        {i18n.t('chat.voice.tapToSpeak')}
                    </Text>
                </View>
            )}
        </View>
    );
}
