import React from 'react';
import { View } from 'react-native';
import { Text, Button } from '@/components/common';
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
    return (
      <View className="px-lg py-md">
        <Text
          preset="bodySmall"
          className="text-center text-text-secondary"
        >
          {i18n.t('planner.cta.approved')}
        </Text>
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
