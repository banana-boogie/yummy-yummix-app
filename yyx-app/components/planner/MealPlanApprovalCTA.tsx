import React from 'react';
import { View } from 'react-native';
import { Button } from '@/components/common';
import i18n from '@/i18n';

interface MealPlanApprovalCTAProps {
  mode: 'draft' | 'active';
  loading: boolean;
  onApprove: () => void;
  onActivePress: () => void;
}

export function MealPlanApprovalCTA({
  mode,
  loading,
  onApprove,
  onActivePress,
}: MealPlanApprovalCTAProps) {
  if (mode === 'active') {
    // There is no shopping-list route in this branch yet, so keep the CTA on
    // the existing planner surface instead of pointing at a dead tab.
    return (
      <View className="px-lg py-md">
        <Button
          variant="outline"
          size="large"
          onPress={onActivePress}
          fullWidth
          style={{ minHeight: 72 }}
          accessibilityLabel={i18n.t('planner.cta.goToToday')}
        >
          {i18n.t('planner.cta.goToToday')}
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
