import React from 'react';
import { Platform, ViewStyle, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

interface BackButtonProps {
  onPress?: () => void;
  className?: string; // Add className support
  style?: ViewStyle;
  variant?: 'light' | 'dark';
}

export function BackButton({ onPress, className = '', style, variant = 'light' }: BackButtonProps) {
  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  };

  return (
    <View className={`
      rounded-3xl
      ${variant === 'light' ? 'bg-white/30' : 'bg-black/70'}
      ${className}
    `} style={style}>
      <TouchableOpacity
        className="bg-transparent p-xs"
        onPress={handlePress}
      >
        <Ionicons
          name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
          size={28}
          color="black" // BackButton always used text defaults, which are black/dark-grey in this app
        />
      </TouchableOpacity>
    </View>
  );
}
