import React from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/common';
import i18n from '@/i18n';

export type CookbookSortOption = 'recent' | 'mostRecipes' | 'alphabetical';

interface CookbookSortBarProps {
  value: CookbookSortOption;
  onChange: (value: CookbookSortOption) => void;
}

export function CookbookSortBar({ value, onChange }: CookbookSortBarProps) {
  const options: Array<{ value: CookbookSortOption; label: string }> = [
    { value: 'recent', label: i18n.t('cookbooks.sort.recent') },
    { value: 'mostRecipes', label: i18n.t('cookbooks.sort.mostRecipes') },
    { value: 'alphabetical', label: i18n.t('cookbooks.sort.alphabetical') },
  ];

  return (
    <View className="px-lg py-sm bg-primary-lightest">
      <Text preset="caption" className="text-text-secondary mb-xs">
        {i18n.t('cookbooks.sort.label')}
      </Text>
      <View className="flex-row flex-wrap gap-sm">
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              className={`px-sm py-xxs rounded-full border ${
                isActive
                  ? 'bg-primary-medium/30 border-primary-medium'
                  : 'bg-white border-neutral-200'
              }`}
            >
              <Text
                preset="caption"
                className={isActive ? 'text-text-default' : 'text-text-secondary'}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
