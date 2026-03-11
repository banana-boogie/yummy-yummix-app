import React, { useState, useEffect } from 'react';
import { View, Modal, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { AdminRecipeUsefulItem, AdminRecipeUsefulItemTranslation, pickTranslation, getTranslatedField } from '@/types/recipe.admin.types';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/i18n';
import { Image } from 'expo-image';
import { TextInput } from '@/components/form/TextInput';
import { useActiveLocales } from '@/hooks/admin/useActiveLocales';
import { translateContent } from '@/services/admin/adminTranslateService';

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
  const { locales } = useActiveLocales();
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [translating, setTranslating] = useState(false);
  const [formData, setFormData] = useState<AdminRecipeUsefulItem>({
    id: '',
    recipeId: '',
    usefulItemId: '',
    displayOrder: 0,
    translations: [],
    usefulItem: {
      id: '',
      translations: [],
      pictureUrl: '',
    },
  });

  useEffect(() => {
    if (visible) {
      if (recipeUsefulItem) {
        setFormData({
          ...recipeUsefulItem,
          translations: recipeUsefulItem.translations || [],
        });
      }
      setErrors({});
    }
  }, [recipeUsefulItem, visible]);

  const getNotesForLocale = (locale: string): string => {
    return pickTranslation(formData.translations, locale)?.notes || '';
  };

  const setNotesForLocale = (locale: string, notes: string) => {
    const existing = formData.translations.find(t => t.locale === locale);
    let updated: AdminRecipeUsefulItemTranslation[];
    if (existing) {
      updated = formData.translations.map(t =>
        t.locale === locale ? { ...t, notes } : t
      );
    } else {
      updated = [...formData.translations, { locale, notes }];
    }
    setFormData(prev => ({ ...prev, translations: updated }));
  };

  const handleAutoTranslate = async () => {
    const sourceTranslation = formData.translations.find(t => t.notes?.trim());
    if (!sourceTranslation) return;

    const sourceLocale = sourceTranslation.locale;
    const targetLocales = locales
      .map(l => l.code)
      .filter(code => code !== sourceLocale);

    if (targetLocales.length === 0) return;

    setTranslating(true);
    try {
      const results = await translateContent(
        { notes: sourceTranslation.notes! },
        sourceLocale,
        targetLocales,
      );

      let updated = [...formData.translations];
      for (const result of results) {
        const existing = updated.find(t => t.locale === result.targetLocale);
        if (existing) {
          updated = updated.map(t =>
            t.locale === result.targetLocale
              ? { ...t, notes: result.fields.notes || t.notes }
              : t
          );
        } else {
          updated.push({ locale: result.targetLocale, notes: result.fields.notes || '' });
        }
      }
      setFormData(prev => ({ ...prev, translations: updated }));
    } catch (error) {
      console.error('Auto-translate failed:', error);
    } finally {
      setTranslating(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    const isDuplicate = existingUsefulItems.some(
      item =>
        item.usefulItemId === formData.usefulItemId &&
        item.id !== formData.id
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

  // Get useful item display names
  const usefulItemNameEn = getTranslatedField(formData.usefulItem?.translations, 'en', 'name');
  const usefulItemNameEs = getTranslatedField(formData.usefulItem?.translations, 'es', 'name');

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
                    {usefulItemNameEn}
                  </Text>
                  <Text className="text-text-SECONDARY">
                    {usefulItemNameEs}
                  </Text>
                </View>
              </View>

              {errors.duplicate && (
                <Text className="text-xs text-status-ERROR mb-sm">
                  {errors.duplicate}
                </Text>
              )}

              {/* Notes - dynamic per locale */}
              {locales.map(locale => (
                <TextInput
                  key={`notes-${locale.code}`}
                  value={getNotesForLocale(locale.code)}
                  onChangeText={(value) => setNotesForLocale(locale.code, value)}
                  containerStyle={{ marginBottom: 16 }}
                  label={`${i18n.t('admin.recipes.form.usefulItemsInfo.notesEnLabel', { defaultValue: 'Notes' })} (${locale.displayName})`}
                />
              ))}

              <Button
                onPress={handleAutoTranslate}
                loading={translating}
                disabled={translating}
                variant="outline"
                size="small"
                className="mb-md"
              >
                {translating
                  ? i18n.t('admin.translate.translating')
                  : i18n.t('admin.translate.autoTranslate')
                }
              </Button>
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
