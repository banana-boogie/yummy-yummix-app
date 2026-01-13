/**
 * VoiceChatScreen Component - Gemini Live Edition
 * 
 * Supports continuous, hands-free conversation with Irmixy.
 */

import React, { useState, useEffect } from 'react';
import { View, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/common/Text';
import { IrmixyAvatar, AvatarState } from './IrmixyAvatar';
import { VoiceButton } from './VoiceButton';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import i18n from '@/i18n';
import { Feather } from '@expo/vector-icons';

interface Props {
    sessionId?: string | null;
    onSessionCreated?: (sessionId: string) => void;
}

export function VoiceChatScreen({ sessionId: initialSessionId, onSessionCreated }: Props) {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();

    const {
        isConnected,
        isConnecting,
        error,
        connect,
        disconnect
    } = useGeminiLive();

    const [avatarState, setAvatarState] = useState<AvatarState>('idle');
    const [duration, setDuration] = useState(0);

    // Map connection state to avatar state
    useEffect(() => {
        if (isConnecting) setAvatarState('thinking');
        else if (isConnected) setAvatarState('listening');
        else setAvatarState('idle');
    }, [isConnecting, isConnected]);

    // Timer for active session
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isConnected) {
            interval = setInterval(() => setDuration(d => d + 1), 1000);
        } else {
            setDuration(0);
        }
        return () => clearInterval(interval);
    }, [isConnected]);

    // Error handling
    useEffect(() => {
        if (error) {
            Alert.alert('Connection Error', error);
        }
    }, [error]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleVoicePress = async () => {
        if (isConnected) {
            await disconnect();
        } else {
            // Build Context
            // TODO: Fetch real user context here
            const context = "You are Irmixy, a specialized cooking assistant. The user is Ian (Keto diet). Currently looking for dinner ideas.";
            await connect(context);
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
            {/* Header / Timer */}
            <View className="items-center pt-md">
                {isConnected && (
                    <View className="bg-background-secondary px-sm py-xs rounded-full">
                        <Text preset="caption" className="text-primary-darkest font-bold">
                            {formatDuration(duration)}
                        </Text>
                    </View>
                )}
            </View>

            {/* Avatar area */}
            <View className="flex-1 justify-center items-center py-md bg-background-default">
                <IrmixyAvatar state={avatarState} size={160} />

                <View className="mt-lg h-6">
                    {isConnecting && (
                        <Text preset="body" className="text-text-secondary text-center">
                            Connecting to Irmixy...
                        </Text>
                    )}
                    {isConnected && (
                        <Text preset="body" className="text-primary-darkest text-center font-bold">
                            Listening...
                        </Text>
                    )}
                    {!isConnected && !isConnecting && (
                        <Text preset="body" className="text-text-secondary text-center">
                            Tap to start conversation
                        </Text>
                    )}
                </View>
            </View>

            {/* Controls */}
            <View className="items-center py-xl border-t border-grey-light bg-background-default">
                <VoiceButton
                    state={isConnected ? 'recording' : 'ready'}
                    onPress={handleVoicePress}
                    size={80}
                    disabled={isConnecting}
                />
                <Text preset="caption" className="text-text-secondary mt-sm">
                    {isConnected
                        ? "Tap to End Call"
                        : "Tap to Connect"
                    }
                </Text>
            </View>
        </View>
    );
}
