/**
 * Plan display orchestrator.
 *
 * Composes the day selector, collapsible day groups, meal cards, progress bar,
 * and approval CTA. Draft vs Active mode is inferred from `shoppingListId`:
 * no shopping list yet → draft (pre-approval); once the "Looks Good" CTA runs,
 * the plan gains a linked list and flips to active.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text } from '@/components/common';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';
import { MealPlanDaySelector } from './MealPlanDaySelector';
import { MealCard } from './MealCard';
import { MealPlanApprovalCTA } from './MealPlanApprovalCTA';
import { MealPlanProgressBar } from './MealPlanProgressBar';
import type {
  MealPlanResponse,
  MealPlanSlotResponse,
  PlanProgress,
} from '@/types/mealPlan';

interface MealPlanViewProps {
  plan: MealPlanResponse;
  todayDayIndex: number;
  progress: PlanProgress;
  isApproving: boolean;
  onApprove: () => void | Promise<void>;
  onCook: (slot: MealPlanSlotResponse) => void;
  onSwap: (slot: MealPlanSlotResponse) => void;
  onSkip: (slot: MealPlanSlotResponse) => void;
}

export function MealPlanView({
  plan,
  todayDayIndex,
  progress,
  isApproving,
  onApprove,
  onCook,
  onSwap,
  onSkip,
}: MealPlanViewProps) {
  const mode: 'draft' | 'active' = plan.shoppingListId ? 'active' : 'draft';

  const slotsByDay = useMemo(() => {
    const grouped = new Map<number, MealPlanSlotResponse[]>();
    for (const slot of plan.slots) {
      const arr = grouped.get(slot.dayIndex) ?? [];
      arr.push(slot);
      grouped.set(slot.dayIndex, arr);
    }
    for (const arr of grouped.values()) {
      arr.sort((a, b) => a.displayOrder - b.displayOrder);
    }
    return grouped;
  }, [plan.slots]);

  const visibleDayIndexes = useMemo(
    () =>
      Array.from(
        new Set([
          ...plan.requestedDayIndexes,
          ...Array.from(slotsByDay.keys()),
        ]),
      ).sort((a, b) => a - b),
    [plan.requestedDayIndexes, slotsByDay],
  );

  const [selectedDay, setSelectedDay] = useState<number>(
    visibleDayIndexes.includes(todayDayIndex)
      ? todayDayIndex
      : (visibleDayIndexes[0] ?? todayDayIndex),
  );
  const [collapsedDays, setCollapsedDays] = useState<Set<number>>(
    () => new Set(visibleDayIndexes.filter((d) => d !== todayDayIndex)),
  );

  const toggleDay = useCallback((i: number) => {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  const handleSelectDay = useCallback(
    (i: number) => {
      setSelectedDay(i);
      setCollapsedDays((prev) => {
        const next = new Set(prev);
        next.delete(i);
        return next;
      });
    },
    [],
  );

  const handleCook = useCallback(
    (slot: MealPlanSlotResponse) => {
      const primary = slot.components.find((c) => c.isPrimary) ?? slot.components[0];
      if (primary?.recipeId) {
        router.push(`/recipes/${primary.recipeId}` as any);
      }
      onCook(slot);
    },
    [onCook],
  );

  const daysWithMeals = useMemo(
    () => new Set(Array.from(slotsByDay.keys())),
    [slotsByDay],
  );

  return (
    <View className="flex-1">
      <View className="py-sm">
        <MealPlanDaySelector
          selectedDayIndex={selectedDay}
          todayDayIndex={todayDayIndex}
          daysWithMeals={daysWithMeals}
          onSelect={handleSelectDay}
          visibleDayIndexes={visibleDayIndexes}
        />
      </View>

      <MealPlanProgressBar progress={progress} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
      >
        {visibleDayIndexes.map((i) => {
          const slots = slotsByDay.get(i) ?? [];
          const collapsed = collapsedDays.has(i);
          const isSelected = selectedDay === i;
          return (
            <View
              key={i}
              className={`rounded-lg ${isSelected ? 'bg-primary-lightest' : ''}`}
            >
              <Pressable
                onPress={() => toggleDay(i)}
                className="flex-row items-center justify-between px-md py-sm"
                accessibilityLabel={i18n.t(DAY_TITLE_KEYS[i])}
              >
                <Text preset="h3">{i18n.t(DAY_TITLE_KEYS[i])}</Text>
                <Ionicons
                  name={collapsed ? 'chevron-down' : 'chevron-up'}
                  size={20}
                  color={COLORS.text.secondary}
                />
              </Pressable>
              {!collapsed && (
                <View className="px-md pb-md gap-sm">
                  {slots.length === 0 ? (
                    <Text
                      preset="bodySmall"
                      className="text-text-secondary"
                    >
                      {i18n.t('planner.dayEmpty')}
                    </Text>
                  ) : (
                    slots.map((slot) => (
                      <MealCard
                        key={slot.id}
                        slot={slot}
                        mode={mode}
                        onCook={mode === 'active' ? handleCook : undefined}
                        onSwap={onSwap}
                        onSkip={onSkip}
                      />
                    ))
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <MealPlanApprovalCTA
        mode={mode}
        loading={isApproving}
        onApprove={() => onApprove()}
      />
    </View>
  );
}

const DAY_TITLE_KEYS = [
  'planner.daysLong.mon',
  'planner.daysLong.tue',
  'planner.daysLong.wed',
  'planner.daysLong.thu',
  'planner.daysLong.fri',
  'planner.daysLong.sat',
  'planner.daysLong.sun',
] as const;
