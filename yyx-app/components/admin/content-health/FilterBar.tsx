import React from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from '@/components/common/Text';
import { COLORS } from '@/constants/design-tokens';
import { IssueFilter, EntityFilter } from '@/services/admin/adminContentHealthService';
import i18n from '@/i18n';

interface FilterBarProps {
  activeFilter: IssueFilter;
  entityFilter: EntityFilter;
  onActiveFilterChange: (filter: IssueFilter) => void;
  onEntityFilterChange: (filter: EntityFilter) => void;
}

interface ChipConfig<T> {
  value: T;
  labelKey: string;
}

const issueChips: ChipConfig<IssueFilter>[] = [
  { value: 'all', labelKey: 'filterAll' },
  { value: 'translation', labelKey: 'filterTranslation' },
  { value: 'image', labelKey: 'filterImage' },
  { value: 'nutrition', labelKey: 'filterNutrition' },
  { value: 'unpublished', labelKey: 'filterUnpublished' },
];

const entityChips: ChipConfig<EntityFilter>[] = [
  { value: 'all', labelKey: 'filterAll' },
  { value: 'recipe', labelKey: 'filterRecipes' },
  { value: 'ingredient', labelKey: 'filterIngredients' },
  { value: 'useful_item', labelKey: 'filterUsefulItems' },
];

function ChipRow<T extends string>({
  chips,
  selected,
  onSelect,
}: {
  chips: ChipConfig<T>[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  const t = (key: string) => i18n.t(`admin.contentHealth.${key}`);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-xs">
      <View className="flex-row gap-xs px-xxs">
        {chips.map((chip) => {
          const isActive = selected === chip.value;
          return (
            <TouchableOpacity
              key={chip.value}
              className={`px-md py-xs rounded-round ${isActive ? 'bg-primary-medium' : 'bg-white border border-border-default'}`}
              onPress={() => onSelect(chip.value)}
              activeOpacity={0.7}
            >
              <Text
                preset="bodySmall"
                className={isActive ? 'text-text-default font-semibold' : 'text-text-secondary'}
              >
                {t(chip.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

export function FilterBar({
  activeFilter,
  entityFilter,
  onActiveFilterChange,
  onEntityFilterChange,
}: FilterBarProps) {
  return (
    <View className="mb-md">
      <ChipRow chips={issueChips} selected={activeFilter} onSelect={onActiveFilterChange} />
      <ChipRow chips={entityChips} selected={entityFilter} onSelect={onEntityFilterChange} />
    </View>
  );
}
