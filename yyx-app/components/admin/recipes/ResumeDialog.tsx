import React from 'react';
import { View, Modal, TouchableOpacity } from 'react-native';
import i18n from '@/i18n';
import { AdminRecipe, getTranslatedField } from '@/types/recipe.admin.types';
import { Text } from '@/components/common/Text';

interface ResumeDialogProps {
  visible: boolean;
  savedRecipe: Partial<AdminRecipe> | null;
  onResume: () => void;
  onStartNew: () => void;
}

export function ResumeDialog({
  visible,
  savedRecipe,
  onResume,
  onStartNew
}: ResumeDialogProps) {
  if (!savedRecipe) return null;

  const nameEn = getTranslatedField(savedRecipe.translations, 'en', 'name');
  const nameEs = getTranslatedField(savedRecipe.translations, 'es', 'name');
  const recipeName = nameEn || nameEs || i18n.t('admin.recipes.resume.untitledRecipe');
  const recipeNameAlt = nameEn && nameEs ? ` (${nameEs})` : '';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
    >
      <View className="flex-1 bg-black/50 justify-center items-center">
        <View className="bg-background-default p-md rounded-lg w-[80%] max-w-[600px]">
          <View className="items-center mb-md">
            <Text className="text-xl font-bold text-text-default">{i18n.t('admin.recipes.resume.title')}</Text>
          </View>

          <View className="mb-md">
            <Text className="text-sm text-text-secondary text-center">
              {i18n.t('admin.recipes.resume.message')}
            </Text>

            <View className="flex-row items-center justify-center mt-md">
              <Text className="text-md font-bold text-text-default">{recipeName}</Text>
              {recipeNameAlt ? (
                <Text className="text-sm text-text-secondary">{recipeNameAlt}</Text>
              ) : null}
            </View>
          </View>

          <View className="flex-row justify-between items-center flex-wrap gap-sm">
            <TouchableOpacity
              className="p-md bg-background-secondary rounded flex-1 min-w-[45%] items-center"
              onPress={onStartNew}
            >
              <Text className="text-sm font-bold text-text-default text-center">
                {i18n.t('admin.recipes.resume.startNew')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="p-md bg-primary-default rounded flex-1 min-w-[45%] items-center"
              onPress={onResume}
            >
              <Text className="text-sm font-bold text-white text-center">
                {i18n.t('admin.recipes.resume.continue')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
