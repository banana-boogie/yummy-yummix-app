import React, { useState, useEffect } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/common/Text';
import { TextInput } from '@/components/form/TextInput';
import { Button } from '@/components/common/Button';
import { Switch } from '@/components/common/Switch';
import { SelectInput } from '@/components/form/SelectInput';
import { Ionicons } from '@expo/vector-icons';
import { AdminMeasurementUnit, AdminRecipeIngredient, AdminRecipeIngredientTranslation, pickTranslation, getTranslatedField } from '@/types/recipe.admin.types';
import i18n from '@/i18n';
import { FormGroup } from '@/components/form/FormGroup';
import { FormRow } from '@/components/form/FormRow';
import { FormDivider } from '@/components/form/FormDivider';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { useDevice } from '@/hooks/useDevice';
import { useActiveLocales } from '@/hooks/admin/useActiveLocales';
import { translateContent } from '@/services/admin/adminTranslateService';

interface RecipeIngredientFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (ingredient: AdminRecipeIngredient) => void;
  recipeIngredient: AdminRecipeIngredient | undefined;
  measurementUnits: AdminMeasurementUnit[];
  existingIngredients?: AdminRecipeIngredient[];
  authoringLocale?: string;
}

interface ValidationErrors {
  quantity?: string;
  measurementUnit?: string;
  recipeSection?: string;
  duplicate?: string;
}

export const RecipeIngredientFormModal: React.FC<RecipeIngredientFormModalProps> = ({
  visible,
  onClose,
  onSave,
  recipeIngredient,
  measurementUnits,
  existingIngredients = [],
  authoringLocale = 'es',
}) => {
  const { isLarge: isLargeScreen } = useDevice();
  const [errors, setErrors] = useState<ValidationErrors>({});

  // Default empty state
  const DEFAULT_FORM_DATA: AdminRecipeIngredient = {
    id: '',
    ingredientId: '',
    ingredient: {
      id: '',
      translations: [],
      pictureUrl: '',
      nutritionalFacts: {
        per_100g: {
          calories: 0,
          protein: 0,
          fat: 0,
          carbohydrates: 0,
        },
      },
    },
    measurementUnit: {
      id: '',
      type: 'unit',
      system: 'metric',
      nameEn: '',
      nameEs: '',
      symbolEn: '',
      symbolEs: '',
    },
    quantity: '',
    optional: false,
    translations: [],
    displayOrder: 0,
  };

  const [formData, setFormData] = useState<AdminRecipeIngredient>(DEFAULT_FORM_DATA);

  useEffect(() => {
    if (visible) {
      if (recipeIngredient) {
        setFormData({
          ...DEFAULT_FORM_DATA,
          ...recipeIngredient,
          translations: recipeIngredient.translations || [],
        });
      } else {
        setFormData(DEFAULT_FORM_DATA);
      }
      setErrors({});
    }
  }, [recipeIngredient, visible]);

  const getTransField = (locale: string, field: string): string => {
    const t = pickTranslation(formData.translations, locale);
    return (t as any)?.[field] || '';
  };

  const setTransField = (locale: string, field: string, value: string) => {
    const existing = formData.translations.find(t => t.locale === locale);
    let updated: AdminRecipeIngredientTranslation[];
    if (existing) {
      updated = formData.translations.map(t =>
        t.locale === locale ? { ...t, [field]: value } : t
      );
    } else {
      updated = [...formData.translations, { locale, [field]: value } as AdminRecipeIngredientTranslation];
    }
    setFormData(prev => ({ ...prev, translations: updated }));
  };

  const handleChange = (key: keyof AdminRecipeIngredient, value: any) => {
    const safeValue = value === undefined || value === null ? '' : value;
    if (key === 'quantity') {
      setFormData((prev) => ({ ...prev, [key]: String(safeValue) }));
    } else {
      setFormData((prev) => ({ ...prev, [key]: safeValue }));
    }
  };

  const handleMeasurementUnitChange = (unitId: string) => {
    const selectedUnit = measurementUnits.find((u) => u.id === unitId);
    if (selectedUnit) {
      handleChange('measurementUnit', selectedUnit);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    if (!formData.quantity) {
      newErrors.quantity = i18n.t('validation.required');
    }

    if (!formData.measurementUnit?.id) {
      newErrors.measurementUnit = i18n.t('validation.required');
    }

    // Check recipeSection is set for at least one locale
    const hasRecipeSection = formData.translations.some(t => t.recipeSection?.trim());
    if (!hasRecipeSection) {
      newErrors.recipeSection = i18n.t('validation.required');
    }

    const isDuplicate = existingIngredients.some(
      ing => {
        const existingSection = getTranslatedField(ing.translations, 'en', 'recipeSection');
        const currentSection = getTransField('en', 'recipeSection');
        return ing.ingredientId === formData.ingredientId &&
          existingSection === currentSection &&
          ing.id !== formData.id;
      }
    );

    if (isDuplicate) {
      newErrors.duplicate = i18n.t('admin.recipes.form.ingredientsInfo.duplicateError', {
        defaultValue: 'This ingredient already exists in this section. Each ingredient can only be used once per section.'
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

  const sortedMeasurementUnits = React.useMemo(() => {
    const priorityUnits = ['gram', 'teaspoon', 'tablespoon'];
    const getName = (unit: AdminMeasurementUnit) => getTranslatedField(unit.translations, 'en', 'name') || getTranslatedField(unit.translations, 'es', 'name');
    const topUnits = measurementUnits.filter(unit =>
      priorityUnits.includes(getName(unit).toLowerCase())
    );
    const otherUnits = measurementUnits
      .filter(unit => !priorityUnits.includes(getName(unit).toLowerCase()))
      .sort((a, b) => getName(a).localeCompare(getName(b)));

    return [...topUnits, ...otherUnits];
  }, [measurementUnits]);

  // Get ingredient display names from translations
  const ingredientNameEn = getTranslatedField(formData.ingredient?.translations, 'en', 'name');
  const ingredientNameEs = getTranslatedField(formData.ingredient?.translations, 'es', 'name');

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black/50 p-md">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="w-full max-w-[900px] max-h-[85vh] justify-center items-center"
        >
          <View className="bg-background-default rounded-lg w-full max-h-full flex-col shadow-md overflow-hidden">
            <View className="flex-row justify-between items-baseline border-b border-border-default pt-lg px-lg pb-sm">
              <Text preset="h1" className="flex-1">
                {i18n.t('admin.recipes.form.ingredientsInfo.addTitle')}
              </Text>
              <TouchableOpacity onPress={onClose} className="p-xs">
                <Ionicons name="close" size={24} className="text-text-SECONDARY" />
              </TouchableOpacity>
            </View>

            <ScrollView
              className="flex-1 px-lg py-md"
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ flexGrow: 1 }}
            >
              {errors.duplicate ? <ErrorMessage message={errors.duplicate} /> : null}

              {/* Ingredient Title & Image */}
              <View className="flex-row items-center justify-between mb-lg">
                <View className="flex-1">
                  <Text preset="h1" className="mb-[2px]">
                    {ingredientNameEn}
                  </Text>
                  <Text preset="subheading" className="mb-[2px]">
                    {ingredientNameEs}
                  </Text>
                </View>
                {formData.ingredient?.pictureUrl && (
                  <View className="items-center ml-md">
                    <Image
                      source={formData.ingredient?.pictureUrl}
                      className={`rounded-md ${isLargeScreen ? 'w-[100px] h-[100px]' : 'w-[80px] h-[80px]'}`}
                      contentFit="contain"
                      transition={300}
                      cachePolicy="memory-disk"
                    />
                  </View>
                )}
              </View>

              {/* Quantity & Measurement Unit */}
              <FormRow>
                <FormGroup required>
                  <TextInput
                    label={i18n.t('admin.recipes.form.ingredientsInfo.quantity')}
                    value={String(formData.quantity)}
                    onChangeText={(value) => handleChange('quantity', value)}
                    keyboardType="numeric"
                    numericOnly
                    allowDecimal
                    error={errors.quantity}
                  />
                </FormGroup>

                <FormGroup required>
                  <SelectInput
                    label={i18n.t('admin.recipes.form.ingredientsInfo.measurementUnit')}
                    value={formData.measurementUnit?.id || ''}
                    options={sortedMeasurementUnits.map((unit) => {
                      const unitName = getTranslatedField(unit.translations, 'en', 'name');
                      const unitSymbol = getTranslatedField(unit.translations, 'en', 'symbol');
                      return {
                        label: unitName ? `${unitName} (${unitSymbol})` : '',
                        value: unit.id,
                      };
                    })}
                    onValueChange={handleMeasurementUnitChange}
                    error={errors.measurementUnit}
                    required
                  />
                </FormGroup>
              </FormRow>

              <FormDivider />

              {/* Notes - single language */}
              <FormRow column>
                <View className="flex-row items-baseline gap-sm">
                  <Text preset="subheading">
                    {i18n.t('admin.recipes.form.ingredientsInfo.notesTitle')}
                  </Text>
                  <Text preset="caption" className="text-sm">
                    {i18n.t('admin.recipes.form.ingredientsInfo.notesHelperText')}
                  </Text>
                </View>
                <FormGroup>
                  <TextInput
                    label={i18n.t('admin.recipes.form.ingredientsInfo.notesTitle')}
                    value={getTransField(authoringLocale, 'notes')}
                    onChangeText={(value) => setTransField(authoringLocale, 'notes', value)}
                  />
                </FormGroup>
              </FormRow>

              <FormDivider />

              {/* Tip - single language */}
              <FormRow column>
                <View className="flex-row items-baseline gap-sm">
                  <Text preset="subheading">
                    {i18n.t('admin.recipes.form.ingredientsInfo.tipTitle')}
                  </Text>
                </View>
                <FormGroup>
                  <TextInput
                    label={i18n.t('admin.recipes.form.ingredientsInfo.tipTitle')}
                    value={getTransField(authoringLocale, 'tip')}
                    onChangeText={(value) => setTransField(authoringLocale, 'tip', value)}
                    multiline={true}
                    numberOfLines={4}
                    className="min-h-[100px] p-md"
                    style={{ textAlignVertical: 'top' }}
                  />
                </FormGroup>
              </FormRow>

              <FormDivider />

              {/* Recipe Section - single language */}
              <FormGroup required>
                <TextInput
                  label={i18n.t('admin.recipes.form.ingredientsInfo.recipeSectionEn', { defaultValue: 'Recipe Section' })}
                  value={getTransField(authoringLocale, 'recipeSection')}
                  onChangeText={(value) => setTransField(authoringLocale, 'recipeSection', value)}
                  error={errors.recipeSection}
                />
              </FormGroup>

              <FormDivider />

              <FormGroup className="py-md">
                <View className="flex-row items-center gap-sm">
                  <Text className="flex-1">
                    {i18n.t('admin.recipes.form.ingredientsInfo.optional')}
                  </Text>
                  <Switch
                    value={formData.optional || false}
                    onValueChange={(value: boolean) => handleChange('optional', value)}
                  />
                </View>
              </FormGroup>
            </ScrollView>

            <View className="flex-row justify-between border-t border-border-DEFAULT p-md">
              <Button
                label={i18n.t('common.cancel')}
                onPress={onClose}
                variant="secondary"
                className="min-w-[120px]"
              />
              <Button
                label={i18n.t('admin.recipes.form.ingredientsInfo.addToRecipe')}
                onPress={handleSubmit}
                variant="primary"
                className="min-w-[120px]"
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export default RecipeIngredientFormModal;
