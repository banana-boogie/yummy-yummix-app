/**
 * IrmixyCookingModal -- Full-screen modal for asking Irmixy questions
 * while cooking. Supports text + voice mode toggle.
 *
 * Reuses ChatScreen and VoiceChatScreen as embedded components --
 * no chat logic duplication. The modal is just a shell with header,
 * mode toggle, and the appropriate screen component.
 */
import React, { useState, useCallback, useRef } from 'react';
import {
    View,
    Modal,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '@/components/common/Text';
import { ChatScreen } from '@/components/chat/ChatScreen';
import { VoiceChatScreen } from '@/components/chat/VoiceChatScreen';
import type { ChatMessage } from '@/services/chatService';
import type { RecipeContext } from '@/services/voice/types';
import { COLORS, SPACING } from '@/constants/design-tokens';
import i18n from '@/i18n';

type CookingChatMode = 'text' | 'voice';

interface IrmixyCookingModalProps {
    visible: boolean;
    onClose: () => void;
    recipeContext: RecipeContext;
}

export function IrmixyCookingModal({
    visible,
    onClose,
    recipeContext,
}: IrmixyCookingModalProps) {
    const insets = useSafeAreaInsets();
    const [mode, setMode] = useState<CookingChatMode>('text');

    // Lifted state for session persistence across close/reopen
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [voiceTranscriptMessages, setVoiceTranscriptMessages] = useState<ChatMessage[]>([]);

    // Ref to stop voice conversation when modal closes
    const stopVoiceRef = useRef<(() => void) | null>(null);

    const handleClose = useCallback(() => {
        // Stop voice conversation if active
        if (mode === 'voice') {
            stopVoiceRef.current?.();
        }
        onClose();
    }, [mode, onClose]);

    const toggleMode = useCallback(() => {
        setMode((m) => (m === 'text' ? 'voice' : 'text'));
    }, []);

    const handleSessionCreated = useCallback((newSessionId: string) => {
        setSessionId(newSessionId);
    }, []);

    // Build the context prefix for text mode
    const contextPrefix = `[Cooking context: "${recipeContext.recipeTitle ?? ''}", step ${recipeContext.currentStep ?? '?'}/${recipeContext.totalSteps ?? '?'}${recipeContext.stepInstructions ? `. Current step: "${recipeContext.stepInstructions}"` : ''}]`;

    const isNative = Platform.OS !== 'web';

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView
                className="flex-1 bg-background-default"
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
            >
                {/* Header */}
                <View
                    className="flex-row items-center justify-between border-b border-border-default bg-background-default"
                    style={{
                        paddingTop: insets.top + SPACING.xs,
                        paddingBottom: SPACING.sm,
                        paddingHorizontal: SPACING.md,
                    }}
                >
                    <View className="flex-row items-center flex-1">
                        <Image
                            source={require('@/assets/images/irmixy-avatar/irmixy-face.png')}
                            style={{ width: 32, height: 32, borderRadius: 16 }}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                        />
                        <View className="ml-sm flex-1">
                            <Text className="font-semibold text-text-primary">
                                {i18n.t('chat.title')}
                            </Text>
                            <Text className="text-xs text-text-secondary" numberOfLines={1}>
                                {i18n.t('chat.cookingModal.contextHint', {
                                    recipeName: recipeContext.recipeTitle ?? '',
                                    step: recipeContext.currentStep ?? '?',
                                    total: recipeContext.totalSteps ?? '?',
                                })}
                            </Text>
                        </View>
                    </View>

                    <View className="flex-row items-center gap-xs">
                        {/* Mode toggle (native only) */}
                        {isNative && (
                            <TouchableOpacity
                                onPress={toggleMode}
                                className="w-10 h-10 rounded-full border-2 border-primary-darkest items-center justify-center"
                                accessibilityLabel={
                                    mode === 'text'
                                        ? i18n.t('chat.cookingModal.switchToVoice')
                                        : i18n.t('chat.cookingModal.switchToText')
                                }
                                accessibilityRole="button"
                            >
                                <MaterialCommunityIcons
                                    name={mode === 'text' ? 'microphone' : 'keyboard'}
                                    size={22}
                                    color={COLORS.primary.darkest}
                                />
                            </TouchableOpacity>
                        )}

                        {/* Close button */}
                        <TouchableOpacity
                            onPress={handleClose}
                            className="w-10 h-10 items-center justify-center"
                            accessibilityLabel={i18n.t('common.close')}
                            accessibilityRole="button"
                        >
                            <MaterialCommunityIcons
                                name="close"
                                size={24}
                                color={COLORS.text.secondary}
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Chat content */}
                <View className="flex-1" style={{ paddingBottom: Math.max(insets.bottom, SPACING.sm) }}>
                    {mode === 'voice' ? (
                        <VoiceChatScreen
                            sessionId={sessionId}
                            onSessionCreated={handleSessionCreated}
                            transcriptMessages={voiceTranscriptMessages}
                            onTranscriptChange={setVoiceTranscriptMessages}
                            recipeContext={recipeContext}
                        />
                    ) : (
                        <ChatScreen
                            sessionId={sessionId}
                            onSessionCreated={handleSessionCreated}
                            messages={messages}
                            onMessagesChange={setMessages}
                            contextPrefix={contextPrefix}
                            emptyStateGreeting={i18n.t('chat.cookingModal.greeting')}
                        />
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
