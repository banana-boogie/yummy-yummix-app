import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/common/Text';
import i18n from '@/i18n';
import { AdminRecipeTag } from '@/types/recipe.admin.types';

interface RecipeTagsListProps {
  tags: AdminRecipeTag[];
}

export function RecipeTagsList({ tags }: RecipeTagsListProps) {
  return (
    <View className="mb-lg w-full">
      {!tags || tags.length === 0 ? (
        <View className="items-center justify-center p-md bg-background-SECONDARY rounded-md min-h-[100px]">
          <Ionicons name="pricetags-outline" size={32} className="text-text-SECONDARY" />
          <Text preset="body" className="mt-sm text-center text-text-SECONDARY">
            {i18n.t('admin.recipes.form.reviewInfo.noTags')}
          </Text>
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-md justify-start">
          {tags.map((tag) => (
            <View key={tag.id} className="flex-row items-center bg-background-SECONDARY py-sm px-md rounded-md border border-primary-LIGHT gap-xs">
              <Ionicons name="pricetag-outline" size={16} className="text-primary-MEDIUM mb-xxs mr-xxs" />
              <Text preset="caption" className="text-text-DEFAULT" numberOfLines={1}>
                {tag.nameEn || ''} | {tag.nameEs || ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default RecipeTagsList;