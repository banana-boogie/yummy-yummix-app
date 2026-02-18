/**
 * VoiceChatScreen Component - OpenAI Realtime Edition
 *
 * Hybrid layout: shrunk avatar + live scrollable transcript with recipe cards.
 * When idle (no messages), avatar displays centered at full size.
 * Once conversation starts, avatar shrinks to top and transcript grows.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Alert, FlatList, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useRouter } from 'expo-router';
import { Text } from '@/components/common/Text';
import { IrmixyAvatar, AvatarState } from './IrmixyAvatar';
import { VoiceButton } from './VoiceButton';
import { ChatRecipeCard } from './ChatRecipeCard';
import { CustomRecipeCard } from './CustomRecipeCard';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { useAuth } from '@/contexts/AuthContext';
import { customRecipeService } from '@/services/customRecipeService';
import { COLORS } from '@/constants/design-tokens';
import type { QuotaInfo, VoiceStatus } from '@/services/voice/types';
import type { ChatMessage } from '@/services/chatService';
import type { GeneratedRecipe } from '@/types/irmixy';
import i18n from '@/i18n';
import { getChatCustomCookingGuidePath } from '@/utils/navigation/recipeRoutes';

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
    const flatListRef = useRef<FlatList>(null);

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
        stopConversation
    } = useVoiceChat({
        sessionId: initialSessionId,
        initialTranscriptMessages: externalMessages,
        onTranscriptChange,
        onQuotaWarning: (info: QuotaInfo) => {
            Alert.alert(
                i18n.t('common.errors.title'),
                info.warning || i18n.t('chat.voice.quotaWarning', { minutes: info.remainingMinutes.toFixed(1) }),
                [{ text: i18n.t('common.ok') }]
            );
        }
    });

    const hasMessages = transcriptMessages.length > 0;

    // Map voice status to avatar state
    const getAvatarState = (voiceStatus: VoiceStatus): AvatarState => {
        switch (voiceStatus) {
            case 'connecting': return 'thinking';
            case 'listening': return 'listening';
            case 'processing': return 'thinking';
            case 'speaking': return 'speaking';
            case 'error': return 'idle';
            default: return 'idle';
        }
    };

    const isConnected = status !== 'idle' && status !== 'error';
    const isConnecting = status === 'connecting';

    // Stop voice when navigating away from this screen
    useFocusEffect(
        useCallback(() => {
            return () => {
                if (isConnected) stopConversation();
            };
        }, [isConnected, stopConversation])
    );

    // Timer for active session (only when truly active, not during connecting)
    const isActive = isConnected && !isConnecting;
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isActive) {
            interval = setInterval(() => setDuration(d => d + 1), 1000);
        } else if (!isConnected) {
            setDuration(0);
        }
        return () => clearInterval(interval);
    }, [isActive, isConnected]);

    // Error handling
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
        } else {
            if (quotaInfo && quotaInfo.remainingMinutes <= 0) {
                Alert.alert(i18n.t('common.errors.title'), i18n.t('chat.voice.quotaExceeded'));
                return;
            }
            await startConversation();
        }
    };

    const handleStartCooking = useCallback(async (
        recipe: GeneratedRecipe,
        finalName: string,
        messageId: string,
        savedRecipeId?: string
    ) => {
        try {
            let recipeId = savedRecipeId;
            if (!recipeId) {
                const { userRecipeId } = await customRecipeService.save(recipe, finalName);
                recipeId = userRecipeId;
                // Write back savedRecipeId to prevent duplicate saves on repeated taps
                if (recipeId) {
                    updateMessage(messageId, { savedRecipeId: recipeId });
                }
            }
            if (recipeId) {
                router.push(getChatCustomCookingGuidePath(recipeId));
            }
        } catch (err) {
            console.error('[VoiceChatScreen] Start cooking error:', err);
            Alert.alert(i18n.t('common.errors.title'), i18n.t('common.errors.generic'));
        }
    }, [router, updateMessage]);

    const renderMessageItem = useCallback(({ item }: { item: ChatMessage }) => {
        const isUser = item.role === 'user';

        return (
            <View className={`px-md mb-sm ${isUser ? 'items-end' : 'items-start'}`}>
                {/* Message bubble */}
                <View
                    className={`max-w-[85%] px-md py-sm rounded-xl ${
                        isUser
                            ? 'bg-primary-medium rounded-br-sm'
                            : 'bg-background-secondary rounded-bl-sm'
                    }`}
                >
                    <Text
                        preset="body"
                        className={isUser ? 'text-white' : 'text-text-default'}
                    >
                        {item.content}
                    </Text>
                </View>

                {/* Recipe cards (assistant only) */}
                {!isUser && item.recipes && item.recipes.length > 0 && (
                    <View className="mt-sm w-full gap-sm">
                        {item.recipes.map(recipe => (
                            <ChatRecipeCard key={recipe.recipeId} recipe={recipe} />
                        ))}
                    </View>
                )}

                {/* Custom recipe card (assistant only) */}
                {!isUser && item.customRecipe && (
                    <View className="mt-sm w-full">
                        <CustomRecipeCard
                            recipe={item.customRecipe}
                            safetyFlags={item.safetyFlags}
                            onStartCooking={handleStartCooking}
                            messageId={item.id}
                            savedRecipeId={item.savedRecipeId}
                        />
                    </View>
                )}
            </View>
        );
    }, [handleStartCooking]);

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
        <View
            className="flex-1 bg-background-default"
            style={{ paddingBottom: insets.bottom }}
        >
            {/* Header / Timer */}
            <View className="items-center pt-md">
                {isActive && (
                    <View className="bg-background-secondary px-sm py-xs rounded-full">
                        <Text preset="caption" className="text-primary-darkest font-bold">
                            {formatDuration(duration)}
                        </Text>
                    </View>
                )}
            </View>

            {/* Avatar area — shrinks when messages exist */}
            <View className={`items-center ${hasMessages ? 'py-sm' : 'py-md'} bg-background-default`}>
                <IrmixyAvatar state={getAvatarState(status)} size={hasMessages ? 100 : 160} />

                {!hasMessages && (
                    <View className="mt-lg h-24 px-md w-full">
                        {status === 'connecting' && (
                            <Text preset="body" className="text-text-secondary text-center">
                                {i18n.t('chat.voice.connecting')}
                            </Text>
                        )}
                        {status === 'listening' && (
                            <Text preset="body" className="text-primary-darkest text-center font-bold">
                                {i18n.t('chat.voice.listening')}
                            </Text>
                        )}
                        {(status === 'processing' || status === 'speaking') && transcript ? (
                            <Text preset="bodySmall" className="text-text-secondary text-center italic mb-xs" numberOfLines={2}>
                                {`"${transcript}"`}
                            </Text>
                        ) : null}
                        {status === 'idle' && (
                            <Text preset="body" className="text-text-secondary text-center">
                                {i18n.t('chat.voice.tapToSpeak')}
                            </Text>
                        )}
                    </View>
                )}

                {hasMessages && (
                    <Text preset="caption" className="text-text-secondary mt-xs">
                        {status === 'listening' ? i18n.t('chat.voice.listening')
                            : status === 'connecting' ? i18n.t('chat.voice.connecting')
                            : status === 'processing' ? i18n.t('chat.voice.thinking')
                            : status === 'speaking' ? i18n.t('chat.voice.speaking')
                            : ''}
                    </Text>
                )}
            </View>

            {/* Scrollable Transcript */}
            {hasMessages && (
                <View className="flex-1">
                    <FlatList
                        ref={flatListRef}
                        data={transcriptMessages}
                        keyExtractor={item => item.id}
                        renderItem={renderMessageItem}
                        contentContainerStyle={{ paddingVertical: 8 }}
                        showsVerticalScrollIndicator={false}
                        removeClippedSubviews={Platform.OS !== 'web'}
                        maxToRenderPerBatch={3}
                        updateCellsBatchingPeriod={50}
                        windowSize={5}
                        initialNumToRender={8}
                        onContentSizeChange={() => {
                            flatListRef.current?.scrollToEnd({ animated: true });
                        }}
                    />

                    {/* Tool execution indicator */}
                    {isExecutingTool && (
                        <View className="flex-row items-center justify-center py-sm gap-sm">
                            <ActivityIndicator size="small" color={COLORS.primary.darkest} />
                            <Text preset="caption" className="text-primary-darkest">
                                {i18n.t('chat.voice.executingTool')}
                            </Text>
                        </View>
                    )}
                </View>
            )}

            {/* Controls */}
            <View className="items-center py-xl border-t border-grey-light bg-background-default">
                <VoiceButton
                    state={isActive ? 'recording' : 'ready'}
                    onPress={handleVoicePress}
                    size={80}
                    disabled={isConnecting}
                />
                <Text preset="caption" className="text-text-secondary mt-sm">
                    {isConnecting
                        ? i18n.t('chat.voice.connecting')
                        : isConnected
                            ? i18n.t('chat.voice.tapToStop')
                            : i18n.t('chat.voice.tapToSpeak')
                    }
                </Text>
                {quotaInfo && !isConnected && (
                    <Text preset="caption" className="text-text-secondary mt-xs text-xs">
                        {i18n.t('chat.voice.minsRemaining', { mins: quotaInfo.remainingMinutes.toFixed(1) })}
                    </Text>
                )}
            </View>
        </View>
    );
}
