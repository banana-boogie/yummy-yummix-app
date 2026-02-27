import React from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    Platform,
    Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '@/components/common/Text';
import { COLORS, SPACING } from '@/constants/design-tokens';
import i18n from '@/i18n';

const ICON_SIZE = 20;

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
    return (
        <View
            className="border-t border-border-default bg-background-default"
            style={{
                paddingTop: SPACING.sm,
                paddingBottom: bottomInset > 0 ? 0 : SPACING.sm,
                marginBottom: bottomInset > 0 ? SPACING.md : 0,
            }}
        >
            {/* Mic pill — inside bordered section, above input row */}
            {Platform.OS !== 'web' && (!isLoading || isListening) && (
                <TouchableOpacity
                    onPress={handleMicPress}
                    activeOpacity={0.7}
                    style={{ paddingHorizontal: SPACING.md, marginBottom: SPACING.sm }}
                >
                    <Animated.View
                        className={`flex-row items-center justify-center rounded-full ${
                            isListening
                                ? 'bg-status-error'
                                : 'bg-background-secondary border border-border-default'
                        }`}
                        style={[
                            { height: SPACING.xxl, paddingHorizontal: SPACING.md },
                            isListening ? { opacity: pulseAnim } : undefined,
                        ]}
                    >
                        <MaterialCommunityIcons
                            name={isListening ? 'stop' : 'microphone'}
                            size={ICON_SIZE}
                            color={isListening ? COLORS.neutral.white : COLORS.text.secondary}
                        />
                        <Text
                            className={`ml-xs text-sm font-medium ${
                                isListening ? 'text-white' : 'text-text-secondary'
                            }`}
                        >
                            {isListening
                                ? i18n.t('chat.voice.listening')
                                : i18n.t('chat.voice.tapToSpeak')}
                        </Text>
                    </Animated.View>
                </TouchableOpacity>
            )}
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
                {isLoading && handleStop ? (
                    <TouchableOpacity
                        testID="stop-button"
                        className="rounded-full justify-center items-center bg-status-error"
                        style={{ width: SPACING.xxl, height: SPACING.xxl, marginLeft: SPACING.xs }}
                        onPress={handleStop}
                        accessibilityLabel={i18n.t('chat.stopGenerating')}
                        accessibilityRole="button"
                    >
                        <MaterialCommunityIcons name="stop" size={ICON_SIZE} color={COLORS.neutral.white} />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        testID="send-button"
                        className={`rounded-full justify-center items-center ${
                            !inputText.trim() ? 'bg-grey-medium' : 'bg-primary-darkest'
                        }`}
                        style={{ width: SPACING.xxl, height: SPACING.xxl, marginLeft: SPACING.xs }}
                        onPress={handleSend}
                        disabled={disabled || !inputText.trim()}
                    >
                        <MaterialCommunityIcons name="send" size={ICON_SIZE} color={COLORS.neutral.white} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}
