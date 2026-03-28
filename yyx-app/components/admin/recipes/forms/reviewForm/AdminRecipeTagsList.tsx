import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/common/Text';
import i18n from '@/i18n';
import { AdminRecipeTag, getTranslatedField } from '@/types/recipe.admin.types';

interface RecipeTagsListProps {
  tags: AdminRecipeTag[];
  displayLocale?: string;
}

export function RecipeTagsList({ tags, displayLocale = 'es' }: RecipeTagsListProps) {
  return (
    <View className="mb-lg w-full">
      {!tags || tags.length === 0 ? (
        <View className="items-center justify-center p-md bg-background-secondary rounded-md min-h-[100px]">
          <Ionicons name="pricetags-outline" size={32} className="text-text-secondary" />
          <Text preset="body" className="mt-sm text-center text-text-secondary">
            {i18n.t('admin.recipes.form.reviewInfo.noTags')}
          </Text>
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-md justify-start">
          {tags.map((tag) => (
            <View key={tag.id} className="flex-row items-center bg-background-secondary py-sm px-md rounded-md border border-primary-light gap-xs">
              <Ionicons name="pricetag-outline" size={16} className="text-primary-medium mb-xxs mr-xxs" />
              <Text preset="caption" className="text-text-default" numberOfLines={1}>
                {getTranslatedField(tag.translations, displayLocale, 'name') || ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default RecipeTagsList;