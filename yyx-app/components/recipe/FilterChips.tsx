/**
 * FilterChips
 *
 * Horizontal scroll of pill-shaped, single-select filter chips used on the
 * Explore page. Deselect by tapping the active chip again. Designed for
 * Lupita — 44px minimum tap target, generous horizontal padding.
 */

import React, { useCallback } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/common/Text';
import { COLORS, SPACING } from '@/constants/design-tokens';

export interface FilterChipFilter {
  maxTime?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  cuisine?: string;
  dietType?: string;
  mealType?: string;
}

export interface FilterChip {
  id: string;
  label: string;
  filter: FilterChipFilter;
}

interface FilterChipsProps {
  chips: FilterChip[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export const FilterChips = React.memo(function FilterChips({
  chips,
  selectedId,
  onSelect,
}: FilterChipsProps) {
  const handlePress = useCallback(
    (id: string) => {
      onSelect(selectedId === id ? null : id);
    },
    [onSelect, selectedId],
  );

  if (!chips.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: SPACING.md,
        gap: SPACING.sm,
        alignItems: 'center',
      }}
    >
      {chips.map((chip) => {
        const isSelected = chip.id === selectedId;
        return (
          <Pressable
            key={chip.id}
            onPress={() => handlePress(chip.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={chip.label}
            style={{
              minHeight: 44,
              paddingHorizontal: SPACING.md,
              justifyContent: 'center',
              borderRadius: 999,
              backgroundColor: isSelected
                ? COLORS.primary.medium
                : COLORS.background.secondary,
              borderWidth: 1,
              borderColor: isSelected
                ? COLORS.primary.dark
                : COLORS.grey.default,
            }}
          >
            <View>
              <Text
                preset="body"
                className={isSelected ? 'text-text-default' : 'text-text-secondary'}
                marginBottom={0}
              >
                {chip.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});
