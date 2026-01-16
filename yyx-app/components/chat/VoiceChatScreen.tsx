/**
 * VoiceChatScreen Component - OpenAI Realtime Edition
 * 
 * Supports continuous, hands-free conversation with Irmixy.
 */

import React, { useState, useEffect } from 'react';
import { View, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/common/Text';
import { IrmixyAvatar, AvatarState } from './IrmixyAvatar';
import { VoiceButton } from './VoiceButton';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { useAuth } from '@/contexts/AuthContext';
import { QuotaInfo, VoiceStatus } from '@/services/voice/types';
import i18n from '@/i18n';

interface Props {
    sessionId?: string | null;
    onSessionCreated?: (sessionId: string) => void;
}

export function VoiceChatScreen({ sessionId: initialSessionId, onSessionCreated }: Props) {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const [duration, setDuration] = useState(0);

    const {
        status,
        transcript,
        response,
        error,
        quotaInfo,
        startConversation,
        stopConversation
    } = useVoiceChat({
        onQuotaWarning: (info: QuotaInfo) => {
            Alert.alert(
                i18n.t('common.errors.title'),
                info.warning || i18n.t('chat.voice.quotaWarning', { minutes: info.remainingMinutes.toFixed(1) }),
                [{ text: i18n.t('common.ok') }]
            );
        }
    });

    // Map voice status to avatar state
    const getAvatarState = (status: VoiceStatus): AvatarState => {
        switch (status) {
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

    // Timer for active session (only when truly active, not during connecting)
    const isActive = isConnected && !isConnecting;
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isActive) {
            interval = setInterval(() => setDuration(d => d + 1), 1000);
        } else {
            setDuration(0);
        }
        return () => clearInterval(interval);
    }, [isActive]);

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
            {/* Header / Timer - only show when truly active, not during connecting */}
            <View className="items-center pt-md">
                {isActive && (
                    <View className="bg-background-secondary px-sm py-xs rounded-full">
                        <Text preset="caption" className="text-primary-darkest font-bold">
                            {formatDuration(duration)}
                        </Text>
                    </View>
                )}
            </View>

            {/* Avatar area */}
            <View className="flex-1 justify-center items-center py-md bg-background-default">
                <IrmixyAvatar state={getAvatarState(status)} size={160} />

                <View className="mt-lg h-24 px-md w-full">
                    {/* Status Text */}
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
                            "{transcript}"
                        </Text>
                    ) : null}
                    {status === 'speaking' && response ? (
                        null
                    ) : null}

                    {status === 'idle' && (
                        <Text preset="body" className="text-text-secondary text-center">
                            {i18n.t('chat.voice.tapToSpeak')}
                        </Text>
                    )}
                </View>
            </View>

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

