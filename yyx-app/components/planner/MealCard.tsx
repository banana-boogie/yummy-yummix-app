import React from 'react';
import { View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Text, Button } from '@/components/common';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';
import type { MealPlanSlotResponse } from '@/types/mealPlan';

export type PlanMode = 'draft' | 'active';

interface MealCardProps {
  slot: MealPlanSlotResponse;
  mode: PlanMode;
  onCook?: (slot: MealPlanSlotResponse) => void;
  onRemove?: (slot: MealPlanSlotResponse) => void;
}

// Swap is deferred to a follow-up PR. The server returns alternatives the
// UI cannot yet present, so shipping the button would dead-end the user.
export function MealCard({ slot, mode, onCook, onRemove }: MealCardProps) {
  const primary =
    slot.components.find((c) => c.isPrimary) ?? slot.components[0];
  // Secondary components ordered by displayOrder. Filter out the primary so
  // it isn't repeated, regardless of whether it has the lowest displayOrder.
  const secondaries = slot.components
    .filter((c) => c !== primary)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const isLeftover = slot.slotType === 'leftover_target_slot';
  const isCooked = slot.status === 'cooked';
  const isRemoved = slot.status === 'skipped';

  const opacity = isRemoved ? 0.5 : 1;
  const cardClass = isLeftover
    ? 'bg-background-secondary border border-grey-light'
    : 'bg-neutral-white border border-grey-light';

  // VoiceOver should announce the full meal bundle, not just the main.
  const allTitles = [primary, ...secondaries]
    .map((c) => c?.title)
    .filter((t): t is string => !!t);
  const a11yLabel = `${slot.displayMealLabel}: ${allTitles.join(' · ')}`;

  return (
    <View
      className={`rounded-lg p-md ${cardClass}`}
      style={{ opacity }}
      accessibilityLabel={a11yLabel}
    >
      <Text preset="caption" className="text-text-secondary mb-xs uppercase">
        {slot.displayMealLabel}
      </Text>

      <View className="flex-row items-center">
        {primary?.imageUrl ? (
          <Image
            source={{ uri: primary.imageUrl }}
            style={{
              width: 64,
              height: 64,
              borderRadius: 8,
              backgroundColor: COLORS.grey.light,
            }}
            contentFit="cover"
          />
        ) : (
          <View
            className="bg-grey-light rounded-md"
            style={{ width: 64, height: 64 }}
          />
        )}
        <View className="flex-1 ml-md">
          <Text preset="subheading" numberOfLines={2}>
            {primary?.title ?? i18n.t('planner.card.untitled')}
          </Text>
          <Text preset="bodySmall" className="text-text-secondary mt-xxs">
            {formatMeta(slot, primary)}
          </Text>
          {isLeftover && (
            <Text preset="caption" className="text-text-secondary mt-xxs">
              {i18n.t('planner.card.leftover')}
            </Text>
          )}
        </View>
      </View>

      {secondaries.length > 0 && (
        <View className="mt-sm">
          {secondaries.map((c) => (
            <Text
              key={c.id}
              preset="caption"
              className="text-text-secondary"
            >
              {c.title}
              {' · '}
              {i18n.t(`planner.card.componentRole.${c.componentRole}`, {
                defaultValue: c.componentRole,
              })}
            </Text>
          ))}
        </View>
      )}

      {slot.coverageComplete === false && (
        <Text preset="caption" className="text-text-secondary mt-xs italic">
          {i18n.t('planner.card.coverageIncomplete')}
        </Text>
      )}

      {isRemoved ? (
        <Text preset="bodySmall" className="text-text-secondary mt-md">
          {i18n.t('planner.card.removed')}
        </Text>
      ) : isCooked ? (
        <Text preset="bodySmall" className="text-status-success mt-md">
          {i18n.t('planner.card.cooked')}
        </Text>
      ) : (
        <View className="flex-row flex-wrap gap-sm mt-md">
          {mode === 'active' && !isLeftover && onCook && (
            <Button
              variant="primary"
              size="small"
              onPress={() => onCook(slot)}
              accessibilityLabel={i18n.t('planner.card.cookNow')}
              style={{ minHeight: 44 }}
            >
              {i18n.t('planner.card.cookNow')}
            </Button>
          )}
          {onRemove && (
            <Pressable
              onPress={() => onRemove(slot)}
              accessibilityLabel={i18n.t('planner.card.remove')}
              className="px-md items-center justify-center"
              style={{ minHeight: 44 }}
            >
              <Text preset="bodySmall" className="text-text-secondary">
                {i18n.t('planner.card.remove')}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function formatMeta(
  slot: MealPlanSlotResponse,
  primary: MealPlanSlotResponse['components'][number] | undefined,
): string {
  const parts: string[] = [];
  if (primary?.totalTimeMinutes != null) {
    parts.push(i18n.t('planner.card.minutes', { n: primary.totalTimeMinutes }));
  }
  if (primary?.difficulty) {
    parts.push(i18n.t(`planner.difficulty.${primary.difficulty}`));
  }
  if (primary?.portions != null) {
    parts.push(i18n.t('planner.card.portions', { n: primary.portions }));
  }
  return parts.join(' · ');
}
