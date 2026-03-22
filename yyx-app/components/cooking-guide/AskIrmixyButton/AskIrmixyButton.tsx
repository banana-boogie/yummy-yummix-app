/**
 * AskIrmixyButton — Avatar with bounce animation and "Irmixy" label.
 *
 * On first render with `animate={true}`: avatar bounces to draw attention.
 * Otherwise shows static avatar with label.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/common/Text';
import i18n from '@/i18n';

const AVATAR_SIZE = 40;
const BOUNCE_DELAY_MS = 500;
const BOUNCE_DURATION_MS = 300;

interface AskIrmixyButtonProps {
  onPress: () => void;
  /** Show bounce animation on the avatar. Default true on first step. */
  animate?: boolean;
}

export function AskIrmixyButton({ onPress, animate = true }: AskIrmixyButtonProps) {
  const avatarScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animate) return;

    const timer = setTimeout(() => {
      Animated.sequence([
        Animated.timing(avatarScale, {
          toValue: 1.15,
          duration: BOUNCE_DURATION_MS / 2,
          useNativeDriver: true,
        }),
        Animated.timing(avatarScale, {
          toValue: 1,
          duration: BOUNCE_DURATION_MS / 2,
          useNativeDriver: true,
        }),
      ]).start();
    }, BOUNCE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [animate, avatarScale]);

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={i18n.t('recipes.cookingGuide.navigation.askIrmixy')}
      accessibilityRole="button"
      activeOpacity={0.7}
    >
      <View className="items-center">
        <Animated.View style={{ transform: [{ scale: avatarScale }] }}>
          <Image
            source={require('@/assets/images/irmixy-avatar/irmixy-face.png')}
            style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </Animated.View>
        <View style={{ marginTop: 2 }}>
          <Text className="text-primary-darkest text-xs font-medium">{i18n.t('recipes.cookingGuide.navigation.irmixyLabel')}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
