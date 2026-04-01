import React, { useState, useEffect } from 'react';
import { View, Modal, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { AdminRecipeKitchenTool, AdminRecipeKitchenToolTranslation, pickTranslation, getTranslatedField } from '@/types/recipe.admin.types';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/i18n';
import { Image } from 'expo-image';
import { TextInput } from '@/components/form/TextInput';
import { useActiveLocales } from '@/hooks/admin/useActiveLocales';
import { translateContent } from '@/services/admin/adminTranslateService';

interface RecipeKitchenToolFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (recipeKitchenTool: AdminRecipeKitchenTool) => void;
  recipeKitchenTool?: AdminRecipeKitchenTool;
  existingKitchenTools?: AdminRecipeKitchenTool[];
  authoringLocale?: string;
}

type ValidationErrors = Record<string, string>;

export const RecipeKitchenToolFormModal: React.FC<RecipeKitchenToolFormModalProps> = ({
  visible,
  onClose,
  onSave,
  recipeKitchenTool,
  existingKitchenTools = [],
  authoringLocale = 'es',
}) => {
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formData, setFormData] = useState<AdminRecipeKitchenTool>({
    id: '',
    recipeId: '',
    kitchenToolId: '',
    displayOrder: 0,
    translations: [],
    kitchenTool: {
      id: '',
      translations: [],
      pictureUrl: '',
    },
  });

  useEffect(() => {
    if (visible) {
      if (recipeKitchenTool) {
        setFormData({
          ...recipeKitchenTool,
          translations: recipeKitchenTool.translations || [],
        });
      }
      setErrors({});
    }
  }, [recipeKitchenTool, visible]);

  const getNotesForLocale = (locale: string): string => {
    return pickTranslation(formData.translations, locale)?.notes || '';
  };

  const setNotesForLocale = (locale: string, notes: string) => {
    const existing = formData.translations.find(t => t.locale === locale);
    let updated: AdminRecipeKitchenToolTranslation[];
    if (existing) {
      updated = formData.translations.map(t =>
        t.locale === locale ? { ...t, notes } : t
      );
    } else {
      updated = [...formData.translations, { locale, notes }];
    }
    setFormData(prev => ({ ...prev, translations: updated }));
  };

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    const isDuplicate = existingKitchenTools.some(
      item =>
        item.kitchenToolId === formData.kitchenToolId &&
        item.id !== formData.id
    );

    if (isDuplicate) {
      newErrors.duplicate = i18n.t('admin.recipes.form.kitchenToolsInfo.duplicateError', {
        defaultValue: 'This kitchen tool is already added to the recipe.'
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSave(formData);
      onClose();
    }
  };

  // Get kitchen tool display names
  const kitchenToolNameEn = getTranslatedField(formData.kitchenTool?.translations, 'en', 'name');
  const kitchenToolNameEs = getTranslatedField(formData.kitchenTool?.translations, 'es', 'name');

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      transparent={true}
      animationType="fade"
    >
      <View className="flex-1 justify-center items-center bg-black/50 p-md">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="w-full max-w-[600px]"
        >
          <View className="bg-background-default rounded-lg w-full shadow-md">
            <View className="flex-row justify-between items-center px-md py-sm border-b border-border-default">
              <Text preset="subheading" className="flex-1">
                {recipeKitchenTool?.id
                  ? i18n.t('admin.recipes.form.kitchenToolsInfo.editItem')
                  : i18n.t('admin.recipes.form.kitchenToolsInfo.addItem')}
              </Text>
              <TouchableOpacity onPress={onClose} className="p-xs">
                <Ionicons name="close" size={24} className="text-text-secondary" />
              </TouchableOpacity>
            </View>

            <ScrollView className="max-h-[500px] p-md">
              <View className="flex-row items-center mb-md p-sm bg-background-secondary rounded-md">
                <View className="w-[60px] h-[60px] rounded-md overflow-hidden bg-background-default justify-center items-center mr-sm">
                  {formData.kitchenTool?.pictureUrl ? (
                    <Image
                      source={formData.kitchenTool.pictureUrl}
                      className="w-full h-full rounded-md"
                      contentFit="contain"
                      transition={300}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <View className="w-full h-full justify-center items-center bg-background-secondary">
                      <Ionicons name="image-outline" size={32} className="text-text-secondary" />
                    </View>
                  )}
                </View>

                <View className="flex-1">
                  <Text preset="subheading" className="mb-1">
                    {kitchenToolNameEn}
                  </Text>
                  <Text className="text-text-secondary">
                    {kitchenToolNameEs}
                  </Text>
                </View>
              </View>

              {errors.duplicate && (
                <Text className="text-xs text-status-error mb-sm">
                  {errors.duplicate}
                </Text>
              )}

              {/* Notes - single language */}
              <TextInput
                value={getNotesForLocale(authoringLocale)}
                onChangeText={(value) => setNotesForLocale(authoringLocale, value)}
                containerStyle={{ marginBottom: 16 }}
                label={i18n.t('admin.recipes.form.kitchenToolsInfo.notesEnLabel', { defaultValue: 'Notes' })}
              />
            </ScrollView>

            <View className="flex-row justify-end p-md border-t border-border-default">
              <Button
                label={i18n.t('common.cancel')}
                onPress={onClose}
                variant="outline"
                className="min-w-[100px] ml-sm"
              />
              <Button
                label={i18n.t('common.save')}
                onPress={handleSubmit}
                className="min-w-[100px] ml-sm"
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};
