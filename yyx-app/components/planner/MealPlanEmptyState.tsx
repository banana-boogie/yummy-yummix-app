import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Text, Button } from '@/components/common';
import i18n from '@/i18n';

interface MealPlanEmptyStateProps {
  variant: 'first-time' | 'ready';
  onPressPlan: () => void;
  loading?: boolean;
}

export function MealPlanEmptyState({
  variant,
  onPressPlan,
  loading,
}: MealPlanEmptyStateProps) {
  const heading =
    variant === 'first-time'
      ? i18n.t('planner.empty.firstTime.heading')
      : i18n.t('planner.empty.ready.heading');
  const subtext =
    variant === 'first-time'
      ? i18n.t('planner.empty.firstTime.subtext')
      : i18n.t('planner.empty.ready.subtext');
  const bullets =
    variant === 'first-time'
      ? [
          i18n.t('planner.empty.firstTime.bullet1'),
          i18n.t('planner.empty.firstTime.bullet2'),
          i18n.t('planner.empty.firstTime.bullet3'),
        ]
      : null;

  return (
    <View className="flex-1 items-center justify-center px-lg">
      <View className="items-center mb-lg">
        <Image
          source={require('@/assets/images/irmixy-avatar/irmixy-face.png')}
          style={{ width: 96, height: 96, borderRadius: 48 }}
          contentFit="cover"
        />
      </View>
      <Text preset="h2" className="text-center mb-sm">
        {heading}
      </Text>
      <Text preset="body" className="text-center text-text-secondary mb-lg">
        {subtext}
      </Text>

      <View className="w-full max-w-sm mb-lg">
        <Button
          variant="primary"
          size="large"
          onPress={onPressPlan}
          loading={loading}
          fullWidth
          style={{ minHeight: 72 }}
          accessibilityLabel={i18n.t('planner.empty.planMyMenu')}
        >
          {i18n.t('planner.empty.planMyMenu')}
        </Button>
      </View>

      {bullets && (
        <View className="gap-sm">
          {bullets.map((b) => (
            <Text
              key={b}
              preset="bodySmall"
              className="text-center text-text-secondary"
            >
              {`• ${b}`}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
