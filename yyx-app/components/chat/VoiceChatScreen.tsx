import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View,
    Alert,
    FlatList,
    ActivityIndicator,
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
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { useAuth } from '@/contexts/AuthContext';
import { customRecipeService } from '@/services/customRecipeService';
import { COLORS } from '@/constants/design-tokens';
import type { QuotaInfo, VoiceStatus } from '@/services/voice/types';
import type { ChatMessage, IrmixyStatus, QuickAction } from '@/services/chatService';
import type { GeneratedRecipe } from '@/types/irmixy';
import i18n from '@/i18n';
import { getChatCustomCookingGuidePath } from '@/utils/navigation/recipeRoutes';

const SCROLL_THRESHOLD = 200;

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
                i18n.t('common.errors.title'),
                info.warning || i18n.t('chat.voice.quotaWarning', { minutes: info.remainingMinutes.toFixed(1) }),
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

    const extraData = useMemo(() => ({ lastMessageId, isExecutingTool, executingToolName }), [lastMessageId, isExecutingTool, executingToolName]);

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
            Alert.alert(i18n.t('common.errors.title'), i18n.t('chat.voice.quotaExceeded'));
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

    const handleActionPress = useCallback((_action: QuickAction) => {
        // Voice mode is speech-driven; no quick actions for now.
    }, []);

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
        flatListRef.current?.scrollToEnd({ animated: true });
    }, []);

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
            {/* ── ACTIVE: compact status bar ── */}
            {isActive && (
                <View className="border-b border-border-default px-md py-sm bg-background-default">
                    <View className="flex-row items-center justify-between">
                        {/* Left: timer + avatar + status */}
                        <View className="flex-row items-center gap-sm">
                            <View className="bg-background-secondary px-sm py-xs rounded-full">
                                <Text preset="caption" className="text-primary-darkest font-bold">
                                    {formatDuration(duration)}
                                </Text>
                            </View>
                            <IrmixyAvatar state={getAvatarState(status)} size={40} />
                            <View accessibilityLiveRegion="polite">
                                <Text preset="caption" className="text-text-secondary">
                                    {getStatusText(status)}
                                </Text>
                            </View>
                        </View>
                        {/* Right: stop button */}
                        <TouchableOpacity
                            onPress={stopConversation}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={i18n.t('chat.voice.stopRecording')}
                            className="flex-row items-center gap-xs bg-status-error px-md py-xs rounded-full"
                        >
                            <Ionicons name="stop" size={14} color="white" />
                            <Text preset="caption" className="text-white font-semibold">
                                {i18n.t('chat.voice.stop')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* ── ACTIVE: message list ── */}
            {isActive ? (
                <View className="flex-1">
                    <FlatList
                        ref={flatListRef}
                        data={transcriptMessages}
                        keyExtractor={item => item.id}
                        renderItem={renderMessage}
                        extraData={extraData}
                        contentContainerStyle={{ paddingVertical: 8 }}
                        onScroll={handleScroll}
                        scrollEventThrottle={200}
                        showsVerticalScrollIndicator={false}
                        removeClippedSubviews={Platform.OS !== 'web'}
                        maxToRenderPerBatch={3}
                        updateCellsBatchingPeriod={50}
                        windowSize={5}
                        initialNumToRender={8}
                        onContentSizeChange={() => {
                            if (isNearBottomRef.current) {
                                flatListRef.current?.scrollToEnd({ animated: true });
                            }
                        }}
                        ListFooterComponent={
                            isExecutingTool ? (
                                <View className="flex-row items-center justify-center py-sm gap-sm">
                                    <ActivityIndicator size="small" color={COLORS.primary.darkest} />
                                    <Text preset="caption" className="text-primary-darkest">
                                        {i18n.t('chat.voice.executingTool')}
                                    </Text>
                                </View>
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
                /* ── IDLE / CONNECTING: big avatar centered ── */
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

            {/* ── Scroll-to-bottom (only when active) ── */}
            {isActive && showScrollButton && (
                <TouchableOpacity
                    onPress={handleScrollToBottom}
                    className="absolute right-4 bottom-4 z-50 bg-primary-default rounded-full p-3 shadow-lg"
                    style={{ elevation: 4 }}
                >
                    <MaterialCommunityIcons name="chevron-double-down" size={24} color="white" />
                </TouchableOpacity>
            )}

            {/* ── IDLE / CONNECTING: bottom voice button ── */}
            {!isActive && (
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
        </View>
    );
}
