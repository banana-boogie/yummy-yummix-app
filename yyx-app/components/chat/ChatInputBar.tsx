import React from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    Platform,
    Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING } from '@/constants/design-tokens';
import i18n from '@/i18n';

const ICON_SIZE = 20;
const BUTTON_SIZE = 40;

interface ActionButtonAreaProps {
    isLoading: boolean;
    isListening: boolean;
    hasText: boolean;
    isNative: boolean;
    handleMicPress: () => void;
    handleSend: () => void;
    handleStop?: () => void;
    pulseAnim: Animated.Value;
    disabled?: boolean;
}

const ActionButtonArea = React.memo(function ActionButtonArea({
    isLoading,
    isListening,
    hasText,
    isNative,
    handleMicPress,
    handleSend,
    handleStop,
    pulseAnim,
    disabled,
}: ActionButtonAreaProps) {
    if (isLoading && !isListening && handleStop) {
        return (
            <TouchableOpacity
                testID="stop-button"
                className="rounded-full justify-center items-center bg-status-error"
                style={{ width: BUTTON_SIZE, height: BUTTON_SIZE, marginLeft: SPACING.xs }}
                onPress={handleStop}
                accessibilityLabel={i18n.t('chat.stopGenerating')}
                accessibilityRole="button"
            >
                <MaterialCommunityIcons name="stop" size={ICON_SIZE} color={COLORS.neutral.white} />
            </TouchableOpacity>
        );
    }

    if (isListening) {
        return (
            <Animated.View style={{ opacity: pulseAnim }}>
                <TouchableOpacity
                    testID="stop-listening-button"
                    className="rounded-full justify-center items-center bg-status-error"
                    style={{ width: BUTTON_SIZE, height: BUTTON_SIZE, marginLeft: SPACING.xs }}
                    onPress={handleMicPress}
                    accessibilityLabel={i18n.t('chat.voice.stopRecording')}
                    accessibilityRole="button"
                >
                    <MaterialCommunityIcons name="stop" size={ICON_SIZE} color={COLORS.neutral.white} />
                </TouchableOpacity>
            </Animated.View>
        );
    }

    if (hasText) {
        return (
            <TouchableOpacity
                testID="send-button"
                className="rounded-full justify-center items-center bg-primary-darkest"
                style={{ width: BUTTON_SIZE, height: BUTTON_SIZE, marginLeft: SPACING.xs }}
                onPress={handleSend}
                disabled={disabled}
                accessibilityLabel={i18n.t('chat.sendButton')}
                accessibilityRole="button"
            >
                <MaterialCommunityIcons name="send" size={ICON_SIZE} color={COLORS.neutral.white} />
            </TouchableOpacity>
        );
    }

    if (isNative) {
        return (
            <TouchableOpacity
                testID="mic-button"
                className="rounded-full justify-center items-center bg-background-secondary"
                style={{ width: BUTTON_SIZE, height: BUTTON_SIZE, marginLeft: SPACING.xs }}
                onPress={disabled ? undefined : handleMicPress}
                disabled={disabled}
                accessibilityLabel={i18n.t('chat.voice.tapToSpeak')}
                accessibilityRole="button"
            >
                <MaterialCommunityIcons name="microphone" size={ICON_SIZE} color={COLORS.text.secondary} />
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            testID="send-button"
            className="rounded-full justify-center items-center bg-grey-medium"
            style={{ width: BUTTON_SIZE, height: BUTTON_SIZE, marginLeft: SPACING.xs }}
            disabled
            accessibilityLabel={i18n.t('chat.sendButton')}
            accessibilityRole="button"
        >
            <MaterialCommunityIcons name="send" size={ICON_SIZE} color={COLORS.neutral.white} />
        </TouchableOpacity>
    );
});

interface ChatInputBarProps {
    inputText: string;
    setInputText: (text: string) => void;
    isLoading: boolean;
    isListening: boolean;
    handleMicPress: () => void;
    handleSend: () => void;
    handleStop?: () => void;
    pulseAnim: Animated.Value;
    bottomInset: number;
    disabled?: boolean;
    disabledMessage?: string;
}

export function ChatInputBar({
    inputText,
    setInputText,
    isLoading,
    isListening,
    handleMicPress,
    handleSend,
    handleStop,
    pulseAnim,
    bottomInset,
    disabled,
    disabledMessage,
}: ChatInputBarProps) {
    const hasText = inputText.trim().length > 0;
    const isNative = Platform.OS !== 'web';

    return (
        <View
            className="border-t border-border-default bg-background-default"
            style={{
                paddingTop: SPACING.sm,
                paddingBottom: Math.max(bottomInset, SPACING.sm),
            }}
        >
            <View
                className="flex-row items-center"
                style={{ paddingHorizontal: SPACING.sm }}
            >
                <TextInput
                    className="flex-1 bg-background-secondary rounded-xl text-base text-text-primary"
                    style={{ minHeight: SPACING.xxl, maxHeight: 120, paddingLeft: SPACING.md + 2, paddingRight: SPACING.sm, paddingTop: SPACING.sm, paddingBottom: SPACING.xs, opacity: disabled ? 0.5 : 1 }}
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder={disabled && disabledMessage ? disabledMessage : isListening ? i18n.t('chat.voice.listening') : i18n.t('chat.inputPlaceholder')}
                    placeholderTextColor={COLORS.text.secondary}
                    multiline
                    maxLength={2000}
                    editable={!isLoading && !disabled}
                />
                <ActionButtonArea
                    isLoading={isLoading}
                    isListening={isListening}
                    hasText={hasText}
                    isNative={isNative}
                    handleMicPress={handleMicPress}
                    handleSend={handleSend}
                    handleStop={handleStop}
                    pulseAnim={pulseAnim}
                    disabled={disabled}
                />
            </View>
        </View>
    );
}
