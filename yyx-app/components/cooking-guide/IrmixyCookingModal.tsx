/**
 * IrmixyCookingModal -- Full-screen modal for asking Irmixy questions
 * while cooking. Supports text + voice mode toggle.
 *
 * Reuses ChatScreen and VoiceChatScreen as embedded components --
 * no chat logic duplication. The modal is just a shell with header,
 * mode toggle, and the appropriate screen component.
 */
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
    View,
    Modal,
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
import type { CookingContext } from '@/types/irmixy';
import { COLORS, SPACING } from '@/constants/design-tokens';
import i18n from '@/i18n';

type CookingChatMode = 'text' | 'voice';

interface IrmixyCookingModalProps {
    visible: boolean;
    onClose: () => void;
    recipeContext: RecipeContext;
    /** External chat session ID — when provided, persists across step navigation via context */
    externalSessionId?: string | null;
    /** Setter for external session ID */
    onExternalSessionIdChange?: (id: string | null) => void;
    /** External chat messages — when provided, persists across step navigation via context */
    externalMessages?: ChatMessage[];
    /** Setter for external messages */
    onExternalMessagesChange?: (messages: ChatMessage[]) => void;
    /** External voice transcript messages */
    externalVoiceTranscriptMessages?: ChatMessage[];
    /** Setter for external voice transcript messages */
    onExternalVoiceTranscriptMessagesChange?: (messages: ChatMessage[]) => void;
}

export function IrmixyCookingModal({
    visible,
    onClose,
    recipeContext,
    externalSessionId,
    onExternalSessionIdChange,
    externalMessages,
    onExternalMessagesChange,
    externalVoiceTranscriptMessages,
    onExternalVoiceTranscriptMessagesChange,
}: IrmixyCookingModalProps) {
    const insets = useSafeAreaInsets();
    const [mode, setMode] = useState<CookingChatMode>('text');

    // Use external state when provided (persists across steps), otherwise local state (persists across close/reopen)
    const [localSessionId, setLocalSessionId] = useState<string | null>(null);
    const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
    const [localVoiceTranscriptMessages, setLocalVoiceTranscriptMessages] = useState<ChatMessage[]>([]);

    const sessionId = externalSessionId !== undefined ? externalSessionId : localSessionId;
    const setSessionId = onExternalSessionIdChange ?? setLocalSessionId;
    const messages = externalMessages ?? localMessages;
    const setMessages = onExternalMessagesChange ?? setLocalMessages;
    const voiceTranscriptMessages = externalVoiceTranscriptMessages ?? localVoiceTranscriptMessages;
    const setVoiceTranscriptMessages = onExternalVoiceTranscriptMessagesChange ?? setLocalVoiceTranscriptMessages;

    // Measure the header + toggle area height for KAV offset.
    // KAV inside a pageSheet modal needs to know the exact height of
    // content above it to calculate keyboard overlap correctly.
    const [headerAreaHeight, setHeaderAreaHeight] = useState(0);

    // When modal closes while in voice mode, switch to text to trigger
    // VoiceChatScreen unmount — its internal useFocusEffect cleanup stops the WebRTC session.
    const prevVisibleRef = useRef(visible);
    useEffect(() => {
        if (prevVisibleRef.current && !visible && mode === 'voice') {
            setMode('text');
        }
        prevVisibleRef.current = visible;
    }, [visible, mode]);

    const toggleMode = useCallback(() => {
        setMode((m) => (m === 'text' ? 'voice' : 'text'));
    }, []);

    const handleSessionCreated = useCallback((newSessionId: string) => {
        setSessionId(newSessionId);
    }, [setSessionId]);

    const isMiseEnPlace = recipeContext.currentStep == null;

    // Build structured cooking context for the backend system prompt
    const cookingContext: CookingContext = useMemo(() => ({
        recipeTitle: recipeContext.recipeTitle ?? '',
        currentStep: isMiseEnPlace
            ? 'Mise en place'
            : `${recipeContext.currentStep ?? '?'}/${recipeContext.totalSteps ?? '?'}`,
        ...(recipeContext.stepInstructions ? { stepInstructions: recipeContext.stepInstructions } : {}),
    }), [recipeContext.recipeTitle, recipeContext.currentStep, recipeContext.totalSteps, recipeContext.stepInstructions, isMiseEnPlace]);

    const isNative = Platform.OS !== 'web';

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-background-default">
                {/* Header + toggle — measured for KAV offset */}
                <View onLayout={(e) => setHeaderAreaHeight(e.nativeEvent.layout.height)}>
                    {/* Header */}
                    <View
                        className="flex-row items-center justify-between border-b border-border-default bg-background-default"
                        style={{
                            paddingTop: insets.top + SPACING.xs,
                            paddingBottom: SPACING.md,
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
                                <Text className="font-semibold text-text-default">
                                    {i18n.t('chat.title')}
                                </Text>
                                <Text className="text-sm text-text-secondary" numberOfLines={1}>
                                    {isMiseEnPlace
                                        ? i18n.t('chat.cookingModal.contextHintMiseEnPlace', {
                                            recipeName: recipeContext.recipeTitle ?? '',
                                        })
                                        : i18n.t('chat.cookingModal.contextHint', {
                                            recipeName: recipeContext.recipeTitle ?? '',
                                            step: recipeContext.currentStep ?? '?',
                                            total: recipeContext.totalSteps ?? '?',
                                        })}
                                </Text>
                            </View>
                        </View>

                        {/* Close button (only) */}
                        <TouchableOpacity
                            onPress={onClose}
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

                    {/* Voice/Text mode toggle bar (native only) */}
                    {isNative && (
                        <View className="flex-row items-center justify-center py-xs px-md bg-primary-lightest">
                            <TouchableOpacity
                                onPress={toggleMode}
                                className="flex-row items-center gap-xs bg-background-default rounded-full px-lg py-xs shadow-sm"
                                accessibilityLabel={
                                    mode === 'text'
                                        ? i18n.t('chat.cookingModal.switchToVoice')
                                        : i18n.t('chat.cookingModal.switchToText')
                                }
                                accessibilityRole="button"
                                style={{ minHeight: 44 }}
                            >
                                <MaterialCommunityIcons
                                    name={mode === 'text' ? 'microphone' : 'keyboard'}
                                    size={24}
                                    color={COLORS.primary.darkest}
                                />
                                <Text preset="bodySmall" className="text-primary-darkest font-semibold">
                                    {mode === 'text'
                                        ? i18n.t('chat.cookingModal.switchToVoice')
                                        : i18n.t('chat.cookingModal.switchToText')
                                    }
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Chat content — KAV offset is measured dynamically from header area */}
                <View className="flex-1">
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
                            cookingContext={cookingContext}
                            disableResume
                            initialGreeting={i18n.t('chat.cookingModal.greeting', { recipeName: recipeContext.recipeTitle ?? '' })}
                            onNavigateAway={onClose}
                            keyboardVerticalOffset={headerAreaHeight + insets.bottom}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}
