import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Alert,
    FlatList,
    ActivityIndicator,
    Platform,
    TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Text } from '@/components/common/Text';
import { IrmixyAvatar, AvatarState } from './IrmixyAvatar';
import { VoiceButton } from './VoiceButton';
import { ChatMessageItem } from '@/components/chat/ChatMessageItem';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { useAuth } from '@/contexts/AuthContext';
import { customRecipeService } from '@/services/customRecipeService';
import { COLORS } from '@/constants/design-tokens';
import type { QuotaInfo, VoiceStatus } from '@/services/voice/types';
import type { ChatMessage, IrmixyStatus, QuickAction } from '@/services/chatService';
import type { GeneratedRecipe } from '@/types/irmixy';
import i18n from '@/i18n';

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
        transcript,
        response,
        error,
        quotaInfo,
        transcriptMessages,
        isExecutingTool,
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
        if (isConnected) {
            stopConversation();
            return;
        }

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
                router.push(`/(tabs)/recipes/start-cooking/${recipeId}?from=chat`);
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
                isLastMessage={item.id === lastMessageId}
                isLoading={isExecutingTool}
                currentStatus={currentStatus}
                statusText={statusText}
                onCopyMessage={handleCopyMessage}
                onStartCooking={handleStartCooking}
                onActionPress={handleActionPress}
            />
        </View>
    ), [
        currentStatus,
        handleActionPress,
        handleCopyMessage,
        handleStartCooking,
        isExecutingTool,
        lastMessageId,
        statusText,
    ]);

    const handleScroll = useCallback((event: any) => {
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
        <View className="flex-1 bg-background-default" style={{ paddingBottom: insets.bottom }}>
            {isConnected && (
                <View className="border-b border-border-default px-md py-sm bg-background-default">
                    <View className="flex-row items-center justify-center gap-sm">
                        {isActive && (
                            <View className="bg-background-secondary px-sm py-xs rounded-full">
                                <Text preset="caption" className="text-primary-darkest font-bold">
                                    {formatDuration(duration)}
                                </Text>
                            </View>
                        )}
                        <IrmixyAvatar state={getAvatarState(status)} size={40} />
                        <View accessibilityLiveRegion="polite">
                            <Text preset="caption" className="text-text-secondary">
                                {getStatusText(status)}
                            </Text>
                        </View>
                    </View>
                </View>
            )}

            {hasMessages ? (
                <View className="flex-1">
                    <FlatList
                        ref={flatListRef}
                        data={transcriptMessages}
                        keyExtractor={item => item.id}
                        renderItem={renderMessage}
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
                </View>
            ) : (
                <View className="flex-1 items-center justify-center px-lg">
                    <IrmixyAvatar state={getAvatarState(status)} size={120} />
                    <View className="mt-lg px-md">
                        <View accessibilityLiveRegion="polite">
                            <Text preset="body" className="text-text-secondary text-center">
                                {isConnected
                                    ? getStatusText(status)
                                    : i18n.t('chat.voice.tapToSpeak')}
                            </Text>
                        </View>
                        {isConnected && transcript ? (
                            <Text
                                preset="bodySmall"
                                className="text-text-secondary text-center italic mt-sm"
                                numberOfLines={2}
                            >
                                {`"${transcript}"`}
                            </Text>
                        ) : null}
                        {isConnected && response ? (
                            <Text
                                preset="bodySmall"
                                className="text-text-secondary text-center italic mt-xs"
                                numberOfLines={2}
                            >
                                {`"${response}"`}
                            </Text>
                        ) : null}
                    </View>
                </View>
            )}

            {showScrollButton && hasMessages && (
                <TouchableOpacity
                    onPress={handleScrollToBottom}
                    className="absolute right-4 bottom-4 z-50 bg-primary-default rounded-full p-3 shadow-lg"
                    style={{ elevation: 4 }}
                >
                    <MaterialCommunityIcons name="chevron-double-down" size={24} color="white" />
                </TouchableOpacity>
            )}

            <View className="items-center py-xl border-t border-grey-light bg-background-default">
                <VoiceButton
                    state={isConnecting ? 'processing' : isActive ? 'recording' : 'ready'}
                    onPress={handleVoicePress}
                    size={72}
                    disabled={isConnecting}
                    accessibilityLabel={
                        isConnected
                            ? i18n.t('chat.voice.stopRecording')
                            : i18n.t('chat.voice.tapToSpeak')
                    }
                />
                <View accessibilityLiveRegion="polite">
                    <Text preset="caption" className="text-text-secondary mt-sm">
                        {isConnecting
                            ? i18n.t('chat.voice.connecting')
                            : isConnected
                                ? i18n.t('chat.voice.tapToStop')
                                : i18n.t('chat.voice.tapToSpeak')}
                    </Text>
                </View>
                {quotaInfo && !isConnected && (
                    <Text preset="caption" className="text-text-secondary mt-xs text-xs">
                        {i18n.t('chat.voice.minsRemaining', { mins: quotaInfo.remainingMinutes.toFixed(1) })}
                    </Text>
                )}
            </View>
        </View>
    );
}
