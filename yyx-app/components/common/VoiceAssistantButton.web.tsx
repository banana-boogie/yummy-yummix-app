import React from 'react';
import { View, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '@/components/common';
import i18n from '@/i18n';
import { COLORS } from '@/constants/design-tokens';
import type { RecipeContext } from '@/services/voice/types';

interface VoiceAssistantButtonProps {
  recipeContext?: RecipeContext;
  position?: 'bottom-right' | 'bottom-center' | 'inline' | 'top-right';
  size?: 'small' | 'medium' | 'large';
}

const sizeMap = {
  small: 48,
  medium: 64,
  large: 80,
};

const positionStyles = {
  'bottom-right': 'absolute bottom-6 right-6 items-end',
  'bottom-center': 'absolute bottom-6 self-center items-center',
  'top-right': 'absolute top-4 right-4 items-end',
  inline: 'items-end',
};

export function VoiceAssistantButton({
  position = 'bottom-right',
  size = 'medium',
}: VoiceAssistantButtonProps) {
  const buttonSize = sizeMap[size];

  const handlePress = () => {
    Alert.alert(
      i18n.t('chat.voice.mobileOnly.title'),
      i18n.t('chat.voice.mobileOnly.message'),
      [{ text: i18n.t('common.ok') }],
    );
  };

  return (
    <View className={positionStyles[position]} testID="web-voice-cta">
      <TouchableOpacity
        testID="web-voice-cta-button"
        onPress={handlePress}
        className="rounded-full border-2 border-primary-darkest bg-background-secondary items-center justify-center shadow-lg"
        style={{ width: buttonSize, height: buttonSize, zIndex: 100 }}
      >
        <MaterialCommunityIcons
          name="microphone-off"
          size={Math.round(buttonSize * 0.42)}
          color={COLORS.primary.darkest}
        />
      </TouchableOpacity>

      <View className="mt-xs px-sm py-xs rounded-full bg-background-secondary border border-border-default max-w-[220px]">
        <Text preset="caption" className="text-text-secondary text-center">
          {i18n.t('chat.voice.mobileOnly.title')}
        </Text>
      </View>
    </View>
  );
}
