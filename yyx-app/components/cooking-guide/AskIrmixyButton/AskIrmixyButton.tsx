/**
 * AskIrmixyButton — Large avatar with pulsing glow ring and bounce animation.
 *
 * Designed for discoverability — Lupita (55+, tech-challenged) needs an obvious
 * tap target. The pulsing peach ring signals interactivity, and the question mark
 * badge reinforces "ask me for help".
 */
import React, { useEffect, useRef } from 'react';
import { Animated, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

const AVATAR_SIZE = 52;
const RING_SIZE = AVATAR_SIZE + 10;
const BOUNCE_DELAY_MS = 500;
const BOUNCE_DURATION_MS = 300;
const PULSE_DURATION_MS = 1800;

interface AskIrmixyButtonProps {
  onPress: () => void;
  /** Show bounce + pulse animation on the avatar. Default true on first step. */
  animate?: boolean;
}

export function AskIrmixyButton({ onPress, animate = true }: AskIrmixyButtonProps) {
  const avatarScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!animate) return;

    // Bounce animation on mount
    const bounceTimer = setTimeout(() => {
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

    // Pulsing glow ring
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, {
          toValue: 1,
          duration: PULSE_DURATION_MS / 2,
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 0.4,
          duration: PULSE_DURATION_MS / 2,
          useNativeDriver: true,
        }),
      ]),
    );
    pulseAnimation.start();

    return () => {
      clearTimeout(bounceTimer);
      pulseAnimation.stop();
    };
  }, [animate, avatarScale, pulseOpacity]);

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={i18n.t('recipes.cookingGuide.navigation.askIrmixy')}
      accessibilityRole="button"
      activeOpacity={0.7}
    >
      <View className="items-center justify-center" style={{ width: RING_SIZE, height: RING_SIZE }}>
        {/* Pulsing glow ring */}
        {animate && (
          <Animated.View
            style={{
              position: 'absolute',
              width: RING_SIZE,
              height: RING_SIZE,
              borderRadius: RING_SIZE / 2,
              borderWidth: 2.5,
              borderColor: COLORS.primary.medium,
              opacity: pulseOpacity,
            }}
          />
        )}
        <Animated.View style={{ transform: [{ scale: avatarScale }] }}>
          <Image
            source={require('@/assets/images/irmixy-avatar/irmixy-face.png')}
            style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          {/* Question mark badge */}
          <View
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: COLORS.primary.medium,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: COLORS.neutral.white,
            }}
          >
            <Ionicons name="help" size={12} color={COLORS.neutral.white} />
          </View>
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}
