import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/i18n';
import { Text } from '@/components/common/Text';
import { COLORS } from '@/constants/design-tokens';

export type ReadinessAnchor = 'plannerRole' | 'foodGroups' | 'mealTypes';

interface MissingChip {
  anchor: ReadinessAnchor;
  label: string;
}

interface ReadinessBadgeProps {
  isReady: boolean;
  missing: MissingChip[];
  onJumpToField?: (anchor: ReadinessAnchor) => void;
}

/**
 * ReadinessBadge — status banner at the top of the My Week Setup step.
 * When ready: green success tile.
 * When missing: red error tile with clickable chips that jump to each missing field.
 */
export function ReadinessBadge({ isReady, missing, onJumpToField }: ReadinessBadgeProps) {
  if (isReady) {
    return (
      <View
        className="flex-row items-center gap-sm p-lg rounded-lg bg-status-success/10 border border-status-success/30 web:transition-[background-color,border-color] web:duration-200"
      >
        <Ionicons name="checkmark-circle" size={20} color={COLORS.status.success} />
        <Text preset="subheading" className="text-status-success">
          {i18n.t('admin.recipes.form.myWeekSetup.eligibility.ready')}
        </Text>
      </View>
    );
  }

  return (
    <View
      className="p-lg rounded-lg bg-status-error/10 border border-status-error/30 web:transition-[background-color,border-color] web:duration-200"
    >
      <Text preset="subheading" className="text-status-error">
        {i18n.t('admin.recipes.form.myWeekSetup.eligibility.missingTitle')}
      </Text>
      <Text preset="bodySmall" className="text-text-secondary mt-xs">
        {i18n.t('admin.recipes.form.myWeekSetup.eligibility.needHelper')}
      </Text>
      {missing.length > 0 ? (
        <View className="flex-row flex-wrap gap-xs mt-md">
          {missing.map((chip) => (
            <Pressable
              key={chip.anchor}
              onPress={() => onJumpToField?.(chip.anchor)}
              accessibilityRole="button"
              accessibilityLabel={i18n.t(
                'admin.recipes.form.myWeekSetup.eligibility.jumpToField',
                { field: chip.label },
              )}
              className="flex-row items-center gap-xs px-sm py-xs rounded-md bg-status-error/15 min-h-[36px] web:hover:bg-status-error/25 web:focus-visible:ring-2 web:focus-visible:ring-status-error/50 web:focus:outline-none"
            >
              <Text preset="bodySmall" className="text-status-error font-semibold">
                {chip.label} →
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
