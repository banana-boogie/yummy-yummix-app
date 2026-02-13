import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Text } from '@/components/common';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { IrmixyAvatar } from '@/components/chat/IrmixyAvatar';
import i18n from '@/i18n';
import type { RecipeContext, QuotaInfo } from '@/services/voice/types';
import { COLORS } from '@/constants/design-tokens';

interface VoiceAssistantButtonProps {
    recipeContext?: RecipeContext;
    position?: 'bottom-right' | 'bottom-center' | 'inline' | 'top-right';
    size?: 'small' | 'medium' | 'large';
}

export function VoiceAssistantButton({
    recipeContext,
    position = 'bottom-right',
    size = 'medium'
}: VoiceAssistantButtonProps) {
    const [showTranscript, setShowTranscript] = useState(false);
    const [showGreeting, setShowGreeting] = useState(false);

    const {
        status,
        transcript,
        response,
        error,
        quotaInfo,
        startConversation,
        stopConversation
    } = useVoiceChat({
        recipeContext,
        onQuotaWarning: (info: QuotaInfo) => {
            Alert.alert(
                i18n.t('chat.voice.quotaWarningTitle'),
                info.warning || i18n.t('chat.voice.quotaWarning', { minutes: info.remainingMinutes.toFixed(1) }),
                [{ text: 'OK' }]
            );
        }
    });

    // Show greeting when status becomes listening, hide when user speaks or stops
    useEffect(() => {
        if (status === 'listening') {
            setShowGreeting(true);
        } else if (status === 'idle' || transcript || response) {
            setShowGreeting(false);
        }
    }, [status, transcript, response]);

    const handlePress = async () => {
        // Disable interaction during connecting
        if (status === 'connecting') {
            return;
        }

        if (status === 'idle') {
            // Start conversation directly without popup (quota warnings handled via onQuotaWarning callback)
            await startConversation();
        } else {
            stopConversation();
        }
    };

    // Size mapping
    const sizeMap = {
        small: 48,
        medium: 64,
        large: 80
    };

    const buttonSize = sizeMap[size];

    // Position styles
    const positionStyles = {
        'bottom-right': 'absolute bottom-6 right-6',
        'bottom-center': 'absolute bottom-6 self-center',
        'top-right': 'absolute top-4 right-4',
        'inline': ''
    };

    // Status-based styling
    const getStatusColor = () => {
        switch (status) {
            case 'listening': return 'bg-status-success'; // Consistently use design tokens
            case 'processing': return 'bg-status-warning';
            case 'speaking': return 'bg-primary-dark';
            case 'error': return 'bg-status-error';
            default: return 'bg-primary-medium';
        }
    };

    // For inline position, wrap in a View to prevent Fragment children from affecting flex layout
    // For absolute positions, use Fragment since the button itself is absolutely positioned
    const content = (
        <>
            <TouchableOpacity
                onPress={handlePress}
                className={`${positionStyles[position]} rounded-full ${getStatusColor()} items-center justify-center shadow-lg`}
                style={{ width: buttonSize, height: buttonSize, zIndex: 100 }}
            >
                {status === 'connecting' || status === 'processing' ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <IrmixyAvatar
                        state={status === 'speaking' ? 'speaking' : status === 'listening' ? 'listening' : 'idle'}
                        size={buttonSize * 0.7}
                    />
                )}
            </TouchableOpacity>

            {/* Connecting status - prominent and obvious */}
            {status === 'connecting' && (
                <View className="absolute bottom-24 left-6 right-6 bg-primary-default rounded-lg p-4 shadow-lg z-50 border-2 border-primary-medium">
                    <View className="flex-row items-center justify-center gap-3">
                        <ActivityIndicator color={COLORS.primary.medium} size="small" />
                        <Text preset="body" className="text-text-default font-semibold">
                            {i18n.t('chat.voice.connecting')}
                        </Text>
                    </View>
                </View>
            )}

            {/* Initial greeting bubble (shown when ready, hidden once user speaks) */}
            {showGreeting && status !== 'connecting' && (
                <View className="absolute bottom-24 left-6 right-6 bg-white rounded-lg p-4 shadow-lg z-50">
                    <Text preset="body" className="text-text-default">
                        {i18n.t('chat.voice.greeting')}
                    </Text>
                </View>
            )}

            {/* Transcript overlay */}
            {(transcript || response) && (
                <View className="absolute bottom-24 left-6 right-6 bg-white rounded-lg p-4 shadow-lg z-50">
                    {transcript ? (
                        <Text preset="bodySmall" className="text-text-secondary mb-2">
                            {i18n.t('chat.voice.userPrefix')}{transcript}
                        </Text>
                    ) : null}
                    {response ? (
                        <Text preset="body" className="text-text-default">
                            Irmixy: {response}
                        </Text>
                    ) : null}
                </View>
            )}

            {/* Error display */}
            {error && (
                <View className="absolute bottom-24 left-6 right-6 bg-status-error rounded-lg p-4 shadow-lg z-50">
                    <Text preset="body" className="text-white">
                        {i18n.t('chat.voice.errorPrefix')}{error}
                    </Text>
                </View>
            )}
        </>
    );

    // Wrap in View for inline position to be a single flex item
    if (position === 'inline') {
        return <View>{content}</View>;
    }

    return content;
}
