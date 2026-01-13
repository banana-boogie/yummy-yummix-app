import React, { useState } from 'react';
import { View } from 'react-native';
import { TextInput } from '@/components/form/TextInput';
import { COLORS } from '@/constants/design-tokens';
import { Ionicons } from '@expo/vector-icons';
import { pickImage } from '@/utils/imageUtils';
import i18n from '@/i18n';
import { AdminRecipe } from '@/types/recipe.admin.types';
import { RecipeDifficulty } from '@/types/recipe.types';
import { FormSection } from '@/components/form/FormSection';
import { FormGroup } from '@/components/form/FormGroup';
import { FormRow } from '@/components/form/FormRow';
import { SelectInput, SelectOption } from '@/components/form/SelectInput';
import { Button } from '@/components/common/Button';
import { AlertModal } from '@/components/common/AlertModal';
import { Image } from 'expo-image';

// Interface for recipe with image file
interface ExtendedRecipe extends Partial<AdminRecipe> {
  _imageFile?: any;
}

interface RecipeInfoFormProps {
  recipe: ExtendedRecipe;
  onUpdateRecipe: (updates: Partial<ExtendedRecipe>) => void;
  errors: Record<string, string>;
}

export function RecipeInfoForm({ recipe, onUpdateRecipe, errors }: RecipeInfoFormProps) {
  const [uploading, setUploading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

  const handlePickImage = async () => {
    setUploading(true);

    await pickImage({
      aspect: [16, 9], // Changed to match the original aspect ratio for recipes
      width: 1200,
      onSuccess: ({ fileObject }) => {
        onUpdateRecipe({
          pictureUrl: fileObject,
          _imageFile: fileObject
        });
      },
      onError: (error) => {
        console.error('Error picking image:', error);
        setShowAlert(true);
      }
    });

    setUploading(false);
  };

  // Define difficulty options for the SelectInput
  const difficultyOptions: SelectOption[] = [
    { label: i18n.t('recipes.common.difficulty.easy'), value: RecipeDifficulty.EASY },
    { label: i18n.t('recipes.common.difficulty.medium'), value: RecipeDifficulty.MEDIUM },
    { label: i18n.t('recipes.common.difficulty.hard'), value: RecipeDifficulty.HARD },
  ];

  return (
    <FormSection title={i18n.t('admin.recipes.form.basicInfo.title')}>
      <FormRow>
        <FormGroup
          label={i18n.t('admin.recipes.form.basicInfo.nameEnglish')}
          required
          error={errors.name}
        >
          <TextInput
            value={recipe.nameEn || ''}
            onChangeText={(text) => onUpdateRecipe({ nameEn: text })}
          />
        </FormGroup>

        <FormGroup
          label={i18n.t('admin.recipes.form.basicInfo.nameSpanish')}
          required
          error={errors.name}
        >
          <TextInput
            value={recipe.nameEs || ''}
            onChangeText={(text) => onUpdateRecipe({ nameEs: text })}
          />
        </FormGroup>
      </FormRow>

      {/* Image container gets its own full-width row to prevent layout issues */}
      <View className="mb-md w-full">
        <FormGroup
          label={i18n.t('admin.recipes.form.basicInfo.recipeImage')}
          required
          error={errors.pictureUrl}
        >
          {recipe.pictureUrl ? (
            <View className="mb-sm items-center">
              <Image
                source={recipe.pictureUrl}
                className="w-full h-[250px] mb-md bg-background-SECONDARY rounded-lg"
                contentFit="contain"
                transition={300}
                cachePolicy="memory-disk"
              />
              <Button
                onPress={handlePickImage}
                disabled={uploading}
                label={i18n.t('admin.recipes.form.basicInfo.changeImage')}
                variant="primary"
                size="medium"
              />
            </View>
          ) : (
            <Button
              onPress={handlePickImage}
              disabled={uploading}
              loading={uploading}
              label={i18n.t('admin.recipes.form.basicInfo.uploadImage')}
              variant="primary"
              size="medium"
              icon={<Ionicons name="cloud-upload-outline" size={24} color={COLORS.neutral.WHITE} />}
            />
          )}
        </FormGroup>
      </View>

      <FormRow>
        <FormGroup
          label={i18n.t('admin.recipes.form.basicInfo.difficulty')}
          required
          error={errors.difficulty}
        >
          <SelectInput
            value={recipe.difficulty || ''}
            options={difficultyOptions}
            onValueChange={(value) => onUpdateRecipe({ difficulty: value as RecipeDifficulty })}
            placeholder={i18n.t('admin.recipes.form.basicInfo.difficultyPlaceholder')}
          />
        </FormGroup>

        <FormGroup
          label={i18n.t('admin.recipes.form.basicInfo.portions')}
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
          label={i18n.t('admin.recipes.form.basicInfo.prepTime')}
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
          label={i18n.t('admin.recipes.form.basicInfo.totalTime')}
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

      <FormRow>
        <FormGroup
          label={i18n.t('admin.recipes.form.basicInfo.tipsAndTricksEnglish')}
        >
          <TextInput
            value={recipe.tipsAndTricksEn || ''}
            onChangeText={(text) => onUpdateRecipe({ tipsAndTricksEn: text })}
            multiline
            numberOfLines={4}
            className="min-h-[100px] p-md"
            style={{ textAlignVertical: 'top' }}
          />
        </FormGroup>
      </FormRow>

      <FormRow>
        <FormGroup
          label={i18n.t('admin.recipes.form.basicInfo.tipsAndTricksSpanish')}
        >
          <TextInput
            value={recipe.tipsAndTricksEs || ''}
            onChangeText={(text) => onUpdateRecipe({ tipsAndTricksEs: text })}
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
    </FormSection>
  );
}
