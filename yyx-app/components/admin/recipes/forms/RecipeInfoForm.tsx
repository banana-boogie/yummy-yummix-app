import React, { useState } from 'react';
import { View } from 'react-native';
import { TextInput } from '@/components/form/TextInput';
import i18n from '@/i18n';
import { AdminRecipe, AdminRecipeTranslation, pickTranslation } from '@/types/recipe.admin.types';
import { RecipeDifficulty } from '@/types/recipe.types';

import { FormGroup } from '@/components/form/FormGroup';
import { FormRow } from '@/components/form/FormRow';
import { SelectInput, SelectOption } from '@/components/form/SelectInput';
import { AlertModal } from '@/components/common/AlertModal';
import { Text } from '@/components/common/Text';
import { ImageUploadSection } from '@/components/admin/recipes/forms/common/ImageUploadSection';
import { AuthoringLanguagePicker } from './shared/AuthoringLanguagePicker';
import logger from '@/services/logger';

// Interface for recipe with image file
interface ExtendedRecipe extends Partial<AdminRecipe> {
  _imageFile?: any;
}

interface RecipeInfoFormProps {
  recipe: ExtendedRecipe;
  onUpdateRecipe: (updates: Partial<ExtendedRecipe>) => void;
  errors: Record<string, string>;
  authoringLocale: string;
  onAuthoringLocaleChange: (locale: string) => void;
}

export function RecipeInfoForm({ recipe, onUpdateRecipe, errors, authoringLocale, onAuthoringLocaleChange }: RecipeInfoFormProps) {
  // Form labels follow the authoring locale so the admin sees labels in the language they're editing
  const tForm = (key: string, opts?: any) => i18n.t(key, { ...opts, locale: authoringLocale });
  const [showAlert, setShowAlert] = useState(false);

  const translations = recipe.translations || [];

  const getTranslationField = (locale: string, field: string): string => {
    const t = pickTranslation(translations, locale);
    return (t as any)?.[field] || '';
  };

  const setTranslationField = (locale: string, field: string, value: string) => {
    const existing = translations.find(t => t.locale === locale);
    let updated: AdminRecipeTranslation[];
    if (existing) {
      updated = translations.map(t =>
        t.locale === locale ? { ...t, [field]: value } : t
      );
    } else {
      updated = [...translations, { locale, name: '', [field]: value } as AdminRecipeTranslation];
    }
    onUpdateRecipe({ translations: updated });
  };

  // Define difficulty options for the SelectInput
  const difficultyOptions: SelectOption[] = [
    { label: i18n.t('recipes.common.difficulty.easy'), value: RecipeDifficulty.EASY },
    { label: i18n.t('recipes.common.difficulty.medium'), value: RecipeDifficulty.MEDIUM },
    { label: i18n.t('recipes.common.difficulty.hard'), value: RecipeDifficulty.HARD },
  ];

  return (
    <View className="mt-lg w-full">
      <AuthoringLanguagePicker value={authoringLocale} onChange={onAuthoringLocaleChange} />

      {/* Name - single language */}
      <FormRow>
        <FormGroup
          label={tForm('admin.recipes.form.basicInfo.nameEnglish', { defaultValue: 'Name' })}
          required
          error={errors.name}
        >
          <TextInput
            value={getTranslationField(authoringLocale, 'name')}
            onChangeText={(text) => setTranslationField(authoringLocale, 'name', text)}
          />
        </FormGroup>
      </FormRow>

      {/* Description - single language */}
      <FormRow>
        <FormGroup
          label={tForm('admin.recipes.form.basicInfo.description', { defaultValue: 'Description' })}
        >
          <TextInput
            value={getTranslationField(authoringLocale, 'description')}
            onChangeText={(text) => setTranslationField(authoringLocale, 'description', text)}
            multiline
            numberOfLines={3}
            className="min-h-[80px] p-md"
            style={{ textAlignVertical: 'top' }}
            placeholder={tForm('admin.recipes.form.basicInfo.descriptionPlaceholder', { defaultValue: 'A short description of the recipe...' })}
          />
        </FormGroup>
      </FormRow>

      {/* Recipe image — 16:9 aspect ratio */}
      <View className="mb-md w-full">
        <ImageUploadSection
          imageUrl={recipe.pictureUrl}
          onImageSelected={(fileObject) => {
            onUpdateRecipe({
              pictureUrl: fileObject,
              _imageFile: fileObject
            });
          }}
          error={errors.pictureUrl}
          required={true}
          aspectRatio={16 / 9}
        />
      </View>

      <FormRow>
        <FormGroup
          label={tForm('admin.recipes.form.basicInfo.difficulty')}
          required
          error={errors.difficulty}
        >
          <SelectInput
            value={recipe.difficulty || ''}
            options={difficultyOptions}
            onValueChange={(value) => onUpdateRecipe({ difficulty: value as RecipeDifficulty })}
            placeholder={tForm('admin.recipes.form.basicInfo.difficultyPlaceholder')}
          />
        </FormGroup>

        <FormGroup
          label={tForm('admin.recipes.form.basicInfo.portions')}
          required
          error={errors.portions}
        >
          <TextInput
            value={recipe.portions?.toString() || ''}
            onChangeText={(text) => onUpdateRecipe({ portions: parseInt(text) || undefined })}
            keyboardType="numeric"
          />
        </FormGroup>
      </FormRow>

      <FormRow>
        <FormGroup
          label={tForm('admin.recipes.form.basicInfo.prepTime')}
          required
          error={errors.prepTime}
        >
          <TextInput
            value={recipe.prepTime?.toString() || ''}
            onChangeText={(text) => onUpdateRecipe({ prepTime: parseInt(text) || undefined })}
            keyboardType="numeric"
          />
        </FormGroup>

        <FormGroup
          label={tForm('admin.recipes.form.basicInfo.totalTime')}
          required
          error={errors.totalTime}
        >
          <TextInput
            value={recipe.totalTime?.toString() || ''}
            onChangeText={(text) => onUpdateRecipe({ totalTime: parseInt(text) || undefined })}
            keyboardType="numeric"
          />
        </FormGroup>
      </FormRow>

      {/* Tips & Tricks - single language */}
      <FormRow>
        <FormGroup
          label={tForm('admin.recipes.form.basicInfo.tipsAndTricksEnglish', { defaultValue: 'Tips & Tricks' })}
        >
          <TextInput
            value={getTranslationField(authoringLocale, 'tipsAndTricks')}
            onChangeText={(text) => setTranslationField(authoringLocale, 'tipsAndTricks', text)}
            multiline
            numberOfLines={4}
            className="min-h-[100px] p-md"
            style={{ textAlignVertical: 'top' }}
          />
        </FormGroup>
      </FormRow>

      <AlertModal
        visible={showAlert}
        title="Error"
        message={i18n.t('common.errors.imagePickerError')}
        onConfirm={() => setShowAlert(false)}
        confirmText="OK"
      />
    </View>
  );
}
