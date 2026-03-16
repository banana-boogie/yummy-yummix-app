/**
 * AskIrmixyButton — Small Irmixy avatar that opens the cooking help modal.
 *
 * Designed to be always visible in the footer area of each cooking step,
 * so Lupita never has to hunt for it.
 */
import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import i18n from '@/i18n';

interface AskIrmixyButtonProps {
  onPress: () => void;
}

export function AskIrmixyButton({ onPress }: AskIrmixyButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={i18n.t('recipes.cookingGuide.navigation.askIrmixy')}
      accessibilityRole="button"
      activeOpacity={0.7}
    >
      <Image
        source={require('@/assets/images/irmixy-avatar/irmixy-face.png')}
        style={{ width: 40, height: 40, borderRadius: 20 }}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    </TouchableOpacity>
  );
}
