import React from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { Text } from '@/components/common';
import i18n from '@/i18n';

const DAY_LABEL_KEYS = [
  'planner.days.mon',
  'planner.days.tue',
  'planner.days.wed',
  'planner.days.thu',
  'planner.days.fri',
  'planner.days.sat',
  'planner.days.sun',
] as const;

interface MealPlanDaySelectorProps {
  selectedDayIndex: number;
  todayDayIndex: number;
  daysWithMeals: Set<number>;
  onSelect: (dayIndex: number) => void;
  visibleDayIndexes?: number[];
}

export function MealPlanDaySelector({
  selectedDayIndex,
  todayDayIndex,
  daysWithMeals,
  onSelect,
  visibleDayIndexes = [0, 1, 2, 3, 4, 5, 6],
}: MealPlanDaySelectorProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
    >
      {visibleDayIndexes.map((i) => {
        const isSelected = selectedDayIndex === i;
        const isToday = todayDayIndex === i;
        const hasMeal = daysWithMeals.has(i);
        return (
          <Pressable
            key={i}
            onPress={() => onSelect(i)}
            accessibilityLabel={i18n.t(DAY_LABEL_KEYS[i])}
            className={`items-center justify-center px-md rounded-lg border-2 ${
              isSelected
                ? 'bg-primary-medium border-primary-medium'
                : isToday
                  ? 'bg-primary-lightest border-primary-medium'
                  : 'bg-background-secondary border-transparent'
            }`}
            style={{ minWidth: 56, minHeight: 64 }}
          >
            <Text preset="bodySmall">{i18n.t(DAY_LABEL_KEYS[i])}</Text>
            {hasMeal && (
              <View
                className={`w-xxxs h-xxxs rounded-full mt-xxs ${
                  isSelected ? 'bg-neutral-white' : 'bg-primary-darkest'
                }`}
              />
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
