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
  { value: 'useful_item', labelKey: 'filterKitchenTools' },
];

// Which issue filters are valid for each entity type
const validIssueFilters: Record<EntityFilter, Set<IssueFilter>> = {
  all: new Set(['all', 'translation', 'image', 'nutrition', 'unpublished']),
  recipe: new Set(['all', 'translation', 'image', 'nutrition', 'unpublished']),
  ingredient: new Set(['all', 'translation', 'image', 'nutrition']),
  useful_item: new Set(['all', 'translation', 'image']),
};

function ChipRow<T extends string>({
  chips,
  selected,
  onSelect,
  disabledValues,
}: {
  chips: ChipConfig<T>[];
  selected: T;
  onSelect: (value: T) => void;
  disabledValues?: Set<T>;
}) {
  const t = (key: string) => i18n.t(`admin.contentHealth.${key}`);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-xs">
      <View className="flex-row gap-xs px-xxs">
        {chips.map((chip) => {
          const isDisabled = disabledValues?.has(chip.value) ?? false;
          const isActive = selected === chip.value && !isDisabled;
          return (
            <TouchableOpacity
              key={chip.value}
              className={`px-md py-xs rounded-round ${
                isActive
                  ? 'bg-primary-medium'
                  : isDisabled
                    ? 'border border-dashed border-grey-medium'
                    : 'bg-white border border-border-default'
              }`}
              style={isDisabled ? { opacity: 0.4 } : undefined}
              onPress={() => !isDisabled && onSelect(chip.value)}
              activeOpacity={isDisabled ? 1 : 0.7}
              disabled={isDisabled}
            >
              <Text
                preset="bodySmall"
                className={
                  isActive
                    ? 'text-text-default font-semibold'
                    : isDisabled
                      ? 'text-text-secondary line-through'
                      : 'text-text-secondary'
                }
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
  const validFilters = validIssueFilters[entityFilter];
  const disabledIssueFilters = new Set(
    issueChips
      .map(c => c.value)
      .filter(v => !validFilters.has(v))
  );

  const handleEntityChange = (entity: EntityFilter) => {
    onEntityFilterChange(entity);
    // Reset issue filter if it becomes invalid for the new entity
    const newValid = validIssueFilters[entity];
    if (!newValid.has(activeFilter)) {
      onActiveFilterChange('all');
    }
  };

  return (
    <View className="mb-md">
      <ChipRow
        chips={issueChips}
        selected={activeFilter}
        onSelect={onActiveFilterChange}
        disabledValues={disabledIssueFilters}
      />
      <ChipRow chips={entityChips} selected={entityFilter} onSelect={handleEntityChange} />
    </View>
  );
}
