import React from 'react';
import i18n from '@/i18n';
import { AdminRecipe } from '@/types/recipe.admin.types';
import { TagSelector, RecipeTagOption } from '@/components/admin/recipes/forms/tagsForm/TagSelector';
import { FormSection } from '@/components/form/FormSection';

interface TagsFormProps {
  recipe: Partial<AdminRecipe>;
  onUpdateRecipe: (updates: Partial<AdminRecipe>) => void;
  errors: Record<string, string>;
}

export function TagsForm({ recipe, onUpdateRecipe, errors }: TagsFormProps) {

  return (
    <FormSection title={i18n.t('admin.recipes.form.tagsInfo.title')}>
      <TagSelector
        selectedTags={recipe.tags as RecipeTagOption[] || []}
        onTagsChange={(tags) => onUpdateRecipe({ tags })}
      />
    </FormSection>
  );
} 