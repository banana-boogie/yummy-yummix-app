import React, { useState, useEffect } from 'react';
import { View, Modal, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { AdminRecipeUsefulItem } from '@/types/recipe.admin.types';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/i18n';
import { Image } from 'expo-image';
import { TextInput } from '@/components/form/TextInput';

interface RecipeUsefulItemFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (recipeUsefulItem: AdminRecipeUsefulItem) => void;
  recipeUsefulItem?: AdminRecipeUsefulItem;
  existingUsefulItems?: AdminRecipeUsefulItem[];
}

type ValidationErrors = Record<string, string>;

export const RecipeUsefulItemFormModal: React.FC<RecipeUsefulItemFormModalProps> = ({
  visible,
  onClose,
  onSave,
  recipeUsefulItem,
  existingUsefulItems = [],
}) => {
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formData, setFormData] = useState<AdminRecipeUsefulItem>({
    id: '',
    recipeId: '',
    usefulItemId: '',
    displayOrder: 0,
    notesEn: '',
    notesEs: '',
    usefulItem: {
      id: '',
      nameEn: '',
      nameEs: '',
      pictureUrl: '',
    },
  });

  useEffect(() => {
    if (visible) {
      if (recipeUsefulItem) {
        setFormData(recipeUsefulItem);
      }
      setErrors({});
    }
  }, [recipeUsefulItem, visible]);

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Check for duplicates - prevent the user from proceeding if a duplicate is found
    const isDuplicate = existingUsefulItems.some(
      item =>
        item.usefulItemId === formData.usefulItemId &&
        item.id !== formData.id // Not the same item we're editing
    );

    if (isDuplicate) {
      newErrors.duplicate = i18n.t('admin.recipes.form.usefulItemsInfo.duplicateError', {
        defaultValue: 'This useful item is already added to the recipe.'
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

  const handleChangeText = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

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
                {recipeUsefulItem?.id
                  ? i18n.t('admin.recipes.form.usefulItemsInfo.editItem')
                  : i18n.t('admin.recipes.form.usefulItemsInfo.addItem')}
              </Text>
              <TouchableOpacity onPress={onClose} className="p-xs">
                <Ionicons name="close" size={24} className="text-text-SECONDARY" />
              </TouchableOpacity>
            </View>

            <ScrollView className="max-h-[500px] p-md">
              <View className="flex-row items-center mb-md p-sm bg-background-SECONDARY rounded-md">
                <View className="w-[60px] h-[60px] rounded-md overflow-hidden bg-background-default justify-center items-center mr-sm">
                  {formData.usefulItem?.pictureUrl ? (
                    <Image
                      source={formData.usefulItem.pictureUrl}
                      className="w-full h-full rounded-md"
                      contentFit="contain"
                      transition={300}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <View className="w-full h-full justify-center items-center bg-background-SECONDARY">
                      <Ionicons name="image-outline" size={32} className="text-text-SECONDARY" />
                    </View>
                  )}
                </View>

                <View className="flex-1">
                  <Text preset="subheading" className="mb-1">
                    {formData.usefulItem?.nameEn}
                  </Text>
                  <Text className="text-text-SECONDARY">
                    {formData.usefulItem?.nameEs}
                  </Text>
                </View>
              </View>

              {errors.duplicate && (
                <Text className="text-xs text-status-ERROR mb-sm">
                  {errors.duplicate}
                </Text>
              )}

              {/* Notes in English */}
              <TextInput
                value={formData.notesEn || ''}
                onChangeText={(value) => handleChangeText('notesEn', value)}
                containerStyle={{ marginBottom: 16 }}
                label={i18n.t('admin.recipes.form.usefulItemsInfo.notesEnLabel', { defaultValue: 'Notes (English)' })}
              />

              {/* Notes in Spanish */}
              <TextInput
                value={formData.notesEs || ''}
                onChangeText={(value) => handleChangeText('notesEs', value)}
                containerStyle={{ marginBottom: 16 }}
                label={i18n.t('admin.recipes.form.usefulItemsInfo.notesEsLabel', { defaultValue: 'Notes (Spanish)' })}
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
