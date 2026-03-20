/**
 * AskIrmixyButton — Animated pill that collapses to an avatar.
 *
 * On first render: shows [avatar] "Ask Irmixy" as a pill.
 * After 3 seconds: text slides out, pill shrinks to just the avatar.
 * After text hides: subtle bounce on the avatar draws attention.
 *
 * When `animate={false}` (e.g. subsequent steps), shows just the avatar
 * immediately — no animation.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/common/Text';
import { COLORS, SPACING } from '@/constants/design-tokens';
import i18n from '@/i18n';

const AVATAR_SIZE = 40;
const PILL_DELAY_MS = 3000;
const COLLAPSE_DURATION_MS = 400;
const BOUNCE_DURATION_MS = 300;
const COLLAPSED_LABEL = 'Irmixy';

interface AskIrmixyButtonProps {
  onPress: () => void;
  /** Show the pill→avatar animation. Default true on first step. */
  animate?: boolean;
  /** Show "Need help?" text inside the pill, before the avatar. Default false. */
  showHelpText?: boolean;
}

export function AskIrmixyButton({ onPress, animate = true, showHelpText = false }: AskIrmixyButtonProps) {
  const textOpacity = useRef(new Animated.Value(animate ? 1 : 0)).current;
  const textWidth = useRef(new Animated.Value(animate ? 1 : 0)).current;
  const avatarScale = useRef(new Animated.Value(1)).current;
  const labelOpacity = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const helpTextOpacity = useRef(new Animated.Value(showHelpText && animate ? 1 : 0)).current;
  const helpTextWidth = useRef(new Animated.Value(showHelpText && animate ? 1 : 0)).current;

  useEffect(() => {
    if (!animate) return;

    const timer = setTimeout(() => {
      // Collapse: fade text + shrink width (both sides collapse toward center avatar)
      const collapseAnimations = [
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: COLLAPSE_DURATION_MS,
          useNativeDriver: false, // width animation can't use native driver
        }),
        Animated.timing(textWidth, {
          toValue: 0,
          duration: COLLAPSE_DURATION_MS,
          useNativeDriver: false,
        }),
      ];
      // Also collapse help text if shown
      if (showHelpText) {
        collapseAnimations.push(
          Animated.timing(helpTextOpacity, {
            toValue: 0,
            duration: COLLAPSE_DURATION_MS,
            useNativeDriver: false,
          }),
          Animated.timing(helpTextWidth, {
            toValue: 0,
            duration: COLLAPSE_DURATION_MS,
            useNativeDriver: false,
          }),
        );
      }
      Animated.parallel(collapseAnimations).start(() => {
        // Fade in the small label + bounce the avatar after text hides
        Animated.parallel([
          Animated.timing(labelOpacity, {
            toValue: 1,
            duration: BOUNCE_DURATION_MS,
            useNativeDriver: true,
          }),
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
          ]),
        ]).start();
      });
    }, PILL_DELAY_MS);

    return () => clearTimeout(timer);
  }, [animate, textOpacity, textWidth, avatarScale, labelOpacity, showHelpText, helpTextOpacity, helpTextWidth]);

  // Interpolate text container width from full to 0
  const textContainerMaxWidth = textWidth.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 120],
  });

  const textContainerPadding = textWidth.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SPACING.sm],
  });

  // Interpolate help text container width and padding
  const helpTextMaxWidth = helpTextWidth.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 130],
  });

  const helpTextPaddingLeft = helpTextWidth.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SPACING.sm],
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={i18n.t('recipes.cookingGuide.navigation.askIrmixy')}
      accessibilityRole="button"
      activeOpacity={0.7}
    >
      <View className="items-center">
        <View
          className="flex-row items-center rounded-full bg-primary-lightest"
          style={{ paddingVertical: SPACING.xxs, paddingLeft: SPACING.xxs, overflow: 'hidden' }}
        >
          {/* "Need help?" text — visible only when showHelpText is true, collapses with animation */}
          {showHelpText && (
            <Animated.View
              style={{
                opacity: helpTextOpacity,
                maxWidth: helpTextMaxWidth,
                paddingLeft: helpTextPaddingLeft,
                overflow: 'hidden',
              }}
            >
              <Text className="text-text-secondary font-medium text-sm" numberOfLines={1}>
                {i18n.t('recipes.cookingGuide.navigation.needHelp')}
              </Text>
            </Animated.View>
          )}
          <Animated.View style={{ transform: [{ scale: avatarScale }] }}>
            <Image
              source={require('@/assets/images/irmixy-avatar/irmixy-face.png')}
              style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </Animated.View>
          <Animated.View
            style={{
              opacity: textOpacity,
              maxWidth: textContainerMaxWidth,
              paddingRight: textContainerPadding,
              overflow: 'hidden',
            }}
          >
            <Text className="text-primary-darkest font-medium text-sm" numberOfLines={1}>
              {i18n.t('recipes.cookingGuide.navigation.askIrmixy')}
            </Text>
          </Animated.View>
        </View>
        {/* Small label visible after pill collapses (or immediately when not animating) */}
        <Animated.View style={{ opacity: labelOpacity, marginTop: 2 }}>
          <Text className="text-primary-darkest text-xs font-medium">{COLLAPSED_LABEL}</Text>
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}
