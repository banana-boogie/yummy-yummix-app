/**
 * VoiceChatScreen Component - With VAD Support
 * 
 * Tap to record, VAD auto-stops on silence (if metering works).
 * Manual stop always available.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/common/Text';
import { IrmixyAvatar, AvatarState } from './IrmixyAvatar';
import { VoiceButton } from './VoiceButton';
import { AudioLevelIndicator } from './AudioLevelIndicator';
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
    const scrollViewRef = useRef<ScrollView>(null);

    const {
        isRecording,
        audioLevel,
        silenceProgress,
        isSpeaking,
        startRecording,
        stopRecording,
        hasPermission,
        requestPermission,
        onUtteranceComplete,
    } = useVoiceRecording();
    const { isPlaying, play, stop: stopPlayback } = useAudioPlayback();

    const [avatarState, setAvatarState] = useState<AvatarState>('idle');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(initialSessionId ?? null);
    const [error, setError] = useState<string | null>(null);

    // Auto-scroll
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages]);

    // Handle VAD auto-stop
    const handleUtteranceComplete = useCallback(async (audioUri: string) => {
        console.log('VAD utterance complete:', audioUri);

        try {
            setAvatarState('thinking');
            setIsProcessing(true);

            const response = await sendVoiceMessage(audioUri, currentSessionId);

            setMessages(prev => [
                ...prev,
                { role: 'user', content: response.transcription },
            ]);

            await new Promise(resolve => setTimeout(resolve, 150));

            setMessages(prev => [
                ...prev,
                { role: 'assistant', content: response.response },
            ]);

            if (!currentSessionId && response.sessionId) {
                setCurrentSessionId(response.sessionId);
                onSessionCreated?.(response.sessionId);
            }

            setAvatarState('speaking');
            const audioFileUri = await base64ToAudioUri(response.audioBase64);
            await play(audioFileUri);

        } catch (err: any) {
            console.error('Voice error:', err);
            setError(err.message || i18n.t('chat.error'));
            setAvatarState('idle');
        } finally {
            setIsProcessing(false);
        }
    }, [currentSessionId, onSessionCreated, play]);

    // Set VAD callback
    useEffect(() => {
        onUtteranceComplete.current = handleUtteranceComplete;
        return () => {
            onUtteranceComplete.current = null;
        };
    }, [handleUtteranceComplete, onUtteranceComplete]);

    // Update avatar when playback finishes
    useEffect(() => {
        if (!isPlaying && avatarState === 'speaking') {
            setAvatarState('idle');
        }
    }, [isPlaying, avatarState]);

    const handleVoicePress = useCallback(async () => {
        setError(null);

        if (isRecording) {
            // Manual stop
            try {
                setAvatarState('thinking');
                setIsProcessing(true);

                const audioUri = await stopRecording();

                if (!audioUri) {
                    setAvatarState('idle');
                    setIsProcessing(false);
                    return;
                }

                const response = await sendVoiceMessage(audioUri, currentSessionId);

                setMessages(prev => [
                    ...prev,
                    { role: 'user', content: response.transcription },
                ]);

                await new Promise(resolve => setTimeout(resolve, 150));

                setMessages(prev => [
                    ...prev,
                    { role: 'assistant', content: response.response },
                ]);

                if (!currentSessionId && response.sessionId) {
                    setCurrentSessionId(response.sessionId);
                    onSessionCreated?.(response.sessionId);
                }

                setAvatarState('speaking');
                const audioDataUri = base64ToAudioUri(response.audioBase64);
                await play(audioDataUri);

            } catch (err: any) {
                console.error('Voice error:', err);
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
                console.error('Recording error:', err);
                setError(err.message);
                setAvatarState('idle');
            }
        }
    }, [isRecording, stopRecording, startRecording, currentSessionId, onSessionCreated, hasPermission, requestPermission, play, stopPlayback]);

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
            style={{ paddingBottom: insets.bottom }}
        >
            {/* Avatar area */}
            <View className="items-center py-md bg-background-default">
                <IrmixyAvatar state={avatarState} size={120} />

                {/* Audio level indicator */}
                {isRecording && (
                    <AudioLevelIndicator
                        audioLevel={audioLevel}
                        silenceProgress={silenceProgress}
                        isSpeaking={isSpeaking}
                        isActive={true}
                    />
                )}

                <View className="mt-sm h-6">
                    {!isRecording && avatarState === 'listening' && (
                        <Text preset="body" className="text-primary-darkest text-center">
                            {i18n.t('chat.voice.listening')}
                        </Text>
                    )}
                    {avatarState === 'thinking' && (
                        <View className="flex-row items-center">
                            <ActivityIndicator size="small" color="#6B7280" />
                            <Text preset="body" className="text-text-secondary text-center ml-xs">
                                {i18n.t('chat.voice.thinking')}
                            </Text>
                        </View>
                    )}
                    {avatarState === 'speaking' && (
                        <Text preset="body" className="text-primary-darkest text-center">
                            {i18n.t('chat.voice.speaking')}
                        </Text>
                    )}
                    {avatarState === 'idle' && messages.length === 0 && (
                        <Text preset="body" className="text-text-secondary text-center">
                            {i18n.t('chat.voice.tapToSpeak')}
                        </Text>
                    )}
                </View>
            </View>

            {/* Chat transcript */}
            <ScrollView
                ref={scrollViewRef}
                className="flex-1 px-md"
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{
                    paddingVertical: 16,
                    flexGrow: 1,
                }}
            >
                {messages.length === 0 ? (
                    <View className="flex-1 justify-center items-center">
                        <Text preset="caption" className="text-text-tertiary text-center px-lg">
                            {i18n.t('chat.greeting')}
                        </Text>
                    </View>
                ) : (
                    messages.map((msg, index) => (
                        <View
                            key={index}
                            className={`mb-sm max-w-[85%] ${msg.role === 'user' ? 'self-end' : 'self-start'}`}
                        >
                            <View
                                className={`rounded-xl p-sm ${msg.role === 'user'
                                    ? 'bg-primary-light rounded-br-sm'
                                    : 'bg-background-secondary rounded-bl-sm'
                                    }`}
                            >
                                <Text
                                    preset="caption"
                                    className={`mb-xs font-bold ${msg.role === 'user'
                                        ? 'text-text-secondary'
                                        : 'text-primary-darkest'
                                        }`}
                                >
                                    {msg.role === 'user' ? i18n.t('common.you') : 'Irmixy'}
                                </Text>
                                <Text preset="body" className="text-text-default">
                                    {msg.content}
                                </Text>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>

            {/* Error display */}
            {error && (
                <View className="px-xl py-xs bg-status-error/10">
                    <Text preset="bodySmall" className="text-status-error text-center">
                        {error}
                    </Text>
                </View>
            )}

            {/* Voice button */}
            <View className="items-center py-md border-t border-grey-light bg-background-default">
                <VoiceButton
                    state={getButtonState()}
                    onPress={handleVoicePress}
                    size={72}
                    disabled={isProcessing}
                />
                <Text preset="caption" className="text-text-secondary mt-xs">
                    {isRecording
                        ? i18n.t('chat.voice.tapToStop')
                        : i18n.t('chat.voice.tapToSpeak')
                    }
                </Text>
            </View>
        </View>
    );
}
