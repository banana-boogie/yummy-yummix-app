/**
 * VoiceChatScreen Component
 * 
 * Voice-first chat interface with Irmixy avatar.
 * Uses i18n for all user-facing text and NativeWind for styling.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/common/Text';
import { IrmixyAvatar, AvatarState } from './IrmixyAvatar';
import { VoiceButton } from './VoiceButton';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { useAudioPlayback } from '@/hooks/useAudioPlayback';
import { useAuth } from '@/contexts/AuthContext';
import { sendVoiceMessage, base64ToAudioUri } from '@/services/voiceService';
import i18n from '@/i18n';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface Props {
    sessionId?: string | null;
    onSessionCreated?: (sessionId: string) => void;
}

export function VoiceChatScreen({ sessionId: initialSessionId, onSessionCreated }: Props) {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();

    const { isRecording, startRecording, stopRecording, hasPermission, requestPermission } = useVoiceRecording();
    const { isPlaying, play, stop: stopPlayback } = useAudioPlayback();

    const [avatarState, setAvatarState] = useState<AvatarState>('idle');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(initialSessionId ?? null);
    const [error, setError] = useState<string | null>(null);

    const handleVoicePress = useCallback(async () => {
        setError(null);

        if (isRecording) {
            // Stop recording and process
            try {
                setAvatarState('thinking');
                setIsProcessing(true);

                const audioUri = await stopRecording();

                if (!audioUri) {
                    console.log('No audio URI returned');
                    setAvatarState('idle');
                    setIsProcessing(false);
                    return;
                }

                console.log('Sending voice message with URI:', audioUri);

                // Send to backend
                const response = await sendVoiceMessage(audioUri, currentSessionId);

                console.log('Got response:', response);

                // Add messages to chat
                setMessages(prev => [
                    ...prev,
                    { role: 'user', content: response.transcription },
                    { role: 'assistant', content: response.response },
                ]);

                if (!currentSessionId && response.sessionId) {
                    setCurrentSessionId(response.sessionId);
                    onSessionCreated?.(response.sessionId);
                }

                // Play audio response
                setAvatarState('speaking');
                const audioDataUri = base64ToAudioUri(response.audioBase64);
                await play(audioDataUri);

            } catch (err: any) {
                console.error('Voice processing error:', err);
                setError(err.message || i18n.t('chat.error'));
                setAvatarState('idle');
            } finally {
                setIsProcessing(false);
            }
        } else {
            // Start recording
            try {
                if (!hasPermission) {
                    const granted = await requestPermission();
                    if (!granted) {
                        setError(i18n.t('chat.voice.permissionRequired'));
                        return;
                    }
                }

                stopPlayback();
                await startRecording();
                setAvatarState('listening');
            } catch (err: any) {
                console.error('Recording start error:', err);
                setError(err.message);
                setAvatarState('idle');
            }
        }
    }, [isRecording, stopRecording, startRecording, currentSessionId, onSessionCreated, hasPermission, requestPermission, play, stopPlayback]);

    // Update avatar state when playback finishes
    useEffect(() => {
        if (!isPlaying && avatarState === 'speaking') {
            setAvatarState('idle');
        }
    }, [isPlaying, avatarState]);

    if (!user) {
        return (
            <View className="flex-1 justify-center items-center px-lg bg-background-default">
                <Text preset="body" className="text-text-secondary text-center">
                    {i18n.t('chat.loginRequired')}
                </Text>
            </View>
        );
    }

    const getButtonState = () => {
        if (isProcessing) return 'processing';
        if (isRecording) return 'recording';
        return 'ready';
    };

    return (
        <View
            className="flex-1 bg-background-default"
            style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        >
            {/* Avatar area */}
            <View className="items-center pt-lg">
                <IrmixyAvatar state={avatarState} size={180} />

                {/* Status text */}
                <View className="mt-md px-xl">
                    {avatarState === 'listening' && (
                        <Text preset="subheading" className="text-primary-darkest text-center">
                            {i18n.t('chat.voice.listening')}
                        </Text>
                    )}
                    {avatarState === 'thinking' && (
                        <Text preset="body" className="text-text-secondary text-center">
                            {i18n.t('chat.voice.thinking')}
                        </Text>
                    )}
                    {avatarState === 'speaking' && (
                        <Text preset="subheading" className="text-primary-darkest text-center">
                            {i18n.t('chat.voice.speaking')}
                        </Text>
                    )}
                    {avatarState === 'idle' && messages.length === 0 && (
                        <Text preset="body" className="text-text-secondary text-center">
                            {i18n.t('chat.greeting')}
                        </Text>
                    )}
                </View>
            </View>

            {/* Chat transcript - scrollable message bubbles */}
            <ScrollView
                className="flex-1 px-md mt-md"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 16 }}
            >
                {messages.map((msg, index) => (
                    <View
                        key={index}
                        className={`mb-sm max-w-[85%] ${msg.role === 'user' ? 'self-end' : 'self-start'
                            }`}
                    >
                        <View
                            className={`rounded-xl p-sm ${msg.role === 'user'
                                    ? 'bg-primary-light rounded-br-sm'
                                    : 'bg-background-secondary rounded-bl-sm'
                                }`}
                        >
                            {msg.role === 'assistant' && (
                                <Text preset="caption" className="text-primary-darkest mb-xs font-bold">
                                    Irmixy
                                </Text>
                            )}
                            <Text preset="body" className="text-text-default">
                                {msg.content}
                            </Text>
                        </View>
                    </View>
                ))}
            </ScrollView>

            {/* Error display */}
            {error && (
                <View className="px-xl pb-sm">
                    <Text preset="bodySmall" className="text-status-error text-center">
                        {error}
                    </Text>
                </View>
            )}

            {/* Voice button */}
            <View className="items-center pb-xl">
                <VoiceButton
                    state={getButtonState()}
                    onPress={handleVoicePress}
                    size={80}
                    disabled={isProcessing}
                />
                <Text preset="caption" className="text-text-secondary mt-sm">
                    {isRecording
                        ? i18n.t('chat.voice.tapToStop')
                        : i18n.t('chat.voice.tapToSpeak')
                    }
                </Text>
            </View>
        </View>
    );
}
