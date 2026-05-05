import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/common';
import i18n from '@/i18n';

interface MealPlanApprovalCTAProps {
  mode: 'draft' | 'active';
  loading: boolean;
  onApprove: () => void;
}

export function MealPlanApprovalCTA({
  mode,
  loading,
  onApprove,
}: MealPlanApprovalCTAProps) {
  if (mode === 'active') {
    // Approved plans link straight to the shopping list — the prior static
    // "Shopping list ready" text earned no space (BUGS.md B-20260504-06).
    return (
      <View className="px-lg py-md">
        <Button
          variant="outline"
          size="large"
          onPress={() => router.push('/(tabs)/shopping' as never)}
          fullWidth
          style={{ minHeight: 72 }}
          accessibilityLabel={i18n.t('planner.cta.viewList')}
        >
          {i18n.t('planner.cta.viewList')}
        </Button>
      </View>
    );
  }

  return (
    <View className="px-lg py-md">
      <Button
        variant="primary"
        size="large"
        onPress={onApprove}
        loading={loading}
        fullWidth
        style={{ minHeight: 72 }}
        accessibilityLabel={i18n.t('planner.cta.approve')}
      >
        {i18n.t('planner.cta.approve')}
      </Button>
    </View>
  );
}
