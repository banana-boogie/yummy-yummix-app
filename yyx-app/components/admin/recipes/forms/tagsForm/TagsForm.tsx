import React from 'react';
import { View } from 'react-native';
import { AdminRecipe } from '@/types/recipe.admin.types';
import { TagSelector, RecipeTagOption } from '@/components/admin/recipes/forms/tagsForm/TagSelector';

interface TagsFormProps {
  recipe: Partial<AdminRecipe>;
  onUpdateRecipe: (updates: Partial<AdminRecipe>) => void;
  errors: Record<string, string>;
  displayLocale?: string;
}

export function TagsForm({ recipe, onUpdateRecipe, errors, displayLocale = 'es' }: TagsFormProps) {

  return (
    <View className="mt-lg w-full">
      <TagSelector
        selectedTags={recipe.tags as RecipeTagOption[] || []}
        onTagsChange={(tags) => onUpdateRecipe({ tags })}
        displayLocale={displayLocale}
      />
    </View>
  );
} 