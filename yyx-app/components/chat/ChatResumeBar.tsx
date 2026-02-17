/**
 * ChatResumeBar Component
 *
 * Dismissable banner shown when user has a recent chat session.
 * Allows quick resume of previous conversation.
 */

import React from 'react';
import { View, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Text } from '@/components/common/Text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ChatResumeBarProps {
    sessionTitle: string;
    onContinue: () => void;
    onDismiss: () => void;
}

export function ChatResumeBar({ sessionTitle, onContinue, onDismiss }: ChatResumeBarProps) {
    const handleDismiss = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        onDismiss();
    };

    return (
        <View
            className="mb-sm bg-primary-lightest rounded-xl p-md border border-primary-medium"
            accessible={true}
            accessibilityRole="alert"
            accessibilityLabel={i18n.t('chat.resume.chatAbout', { title: sessionTitle })}
        >
            <View className="flex-row items-center">
                <MaterialCommunityIcons
                    name="chat-processing-outline"
                    size={20}
                    color={COLORS.primary.darkest}
                />
                <Text className="flex-1 text-text-primary text-sm ml-sm" numberOfLines={2}>
                    {i18n.t('chat.resume.chatAbout', { title: sessionTitle })}
                </Text>
                <TouchableOpacity
                    onPress={handleDismiss}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={i18n.t('common.cancel')}
                >
                    <MaterialCommunityIcons name="close" size={18} color={COLORS.grey.medium} />
                </TouchableOpacity>
            </View>
            <TouchableOpacity
                onPress={onContinue}
                className="mt-sm self-start bg-primary-darkest px-md py-xs rounded-lg"
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={i18n.t('chat.resume.continue')}
            >
                <Text className="text-white text-sm font-semibold">
                    {i18n.t('chat.resume.continue')}
                </Text>
            </TouchableOpacity>
        </View>
    );
}
