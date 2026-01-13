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
import { AdminMeasurementUnit, AdminRecipeIngredient } from '@/types/recipe.admin.types';
import i18n from '@/i18n';
import { FormGroup } from '@/components/form/FormGroup';
import { FormRow } from '@/components/form/FormRow';
import { FormDivider } from '@/components/form/FormDivider';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { useDevice } from '@/hooks/useDevice';

interface RecipeIngredientFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (ingredient: AdminRecipeIngredient) => void;
  recipeIngredient: AdminRecipeIngredient | undefined;
  measurementUnits: AdminMeasurementUnit[];
  existingIngredients?: AdminRecipeIngredient[];
}

interface ValidationErrors {
  quantity?: string;
  measurementUnit?: string;
  recipeSectionEn?: string;
  recipeSectionEs?: string;
  duplicate?: string;
}

export const RecipeIngredientFormModal: React.FC<RecipeIngredientFormModalProps> = ({
  visible,
  onClose,
  onSave,
  recipeIngredient,
  measurementUnits,
  existingIngredients = [],
}) => {
  const { isLarge: isLargeScreen } = useDevice();
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formData, setFormData] = useState<AdminRecipeIngredient>({
    id: '',
    ingredientId: '',
    ingredient: {
      id: '',
      nameEn: '',
      nameEs: '',
      pluralNameEn: '',
      pluralNameEs: '',
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
    notesEn: '',
    notesEs: '',
    tipEn: '',
    tipEs: '',
    recipeSectionEn: '',
    recipeSectionEs: '',
    displayOrder: 0,
  });

  // Default empty state constant
  const DEFAULT_FORM_DATA: AdminRecipeIngredient = {
    id: '',
    ingredientId: '',
    ingredient: {
      id: '',
      nameEn: '',
      nameEs: '',
      pluralNameEn: '',
      pluralNameEs: '',
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
    notesEn: '',
    notesEs: '',
    tipEn: '',
    tipEs: '',
    recipeSectionEn: '',
    recipeSectionEs: '',
    displayOrder: 0,
  };

  useEffect(() => {
    if (visible) {
      if (recipeIngredient) {
        // Merge with default data to ensure no undefined values (fixes controlled/uncontrolled error)
        // and to ensure missing fields in recipeIngredient override with empty strings (fixes persistence bug)
        setFormData({
          ...DEFAULT_FORM_DATA,
          ...recipeIngredient,
          // Explicitly fallback to empty string for optional string fields if they are null/undefined
          notesEn: recipeIngredient.notesEn || '',
          notesEs: recipeIngredient.notesEs || '',
          tipEn: recipeIngredient.tipEn || '',
          tipEs: recipeIngredient.tipEs || '',
          recipeSectionEn: recipeIngredient.recipeSectionEn || '',
          recipeSectionEs: recipeIngredient.recipeSectionEs || '',
        });
      } else {
        // Reset to default state when opening for a new ingredient
        setFormData(DEFAULT_FORM_DATA);
      }
      setErrors({});
    }
  }, [recipeIngredient, visible]);

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

    if (!formData.recipeSectionEn) {
      newErrors.recipeSectionEn = i18n.t('validation.required');
    }

    if (!formData.recipeSectionEs) {
      newErrors.recipeSectionEs = i18n.t('validation.required');
    }

    const isDuplicate = existingIngredients.some(
      ing =>
        ing.ingredientId === formData.ingredientId &&
        ing.recipeSectionEn === formData.recipeSectionEn &&
        ing.id !== formData.id
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
    const topUnits = measurementUnits.filter(unit =>
      priorityUnits.includes(unit.nameEn?.toLowerCase() || unit.nameEs?.toLowerCase())
    );
    const otherUnits = measurementUnits
      .filter(unit => !priorityUnits.includes(unit.nameEn?.toLowerCase() || unit.nameEs?.toLowerCase()))
      .sort((a, b) => a.nameEn?.localeCompare(b.nameEn) || 0);

    return [...topUnits, ...otherUnits];
  }, [measurementUnits]);

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
                    {formData.ingredient?.nameEn}
                  </Text>
                  <Text preset="subheading" className="mb-[2px]">
                    {formData.ingredient?.nameEs}
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
                    options={sortedMeasurementUnits.map((unit) => ({
                      label: unit.nameEn ? `${unit.nameEn} (${unit.symbolEn})` : '',
                      value: unit.id,
                    }))}
                    onValueChange={handleMeasurementUnitChange}
                    error={errors.measurementUnit}
                    required
                  />
                </FormGroup>
              </FormRow>

              <FormDivider />

              {/* Notes */}
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
                    label={i18n.t('admin.recipes.form.ingredientsInfo.notesEn')}
                    value={formData.notesEn}
                    onChangeText={(value) => handleChange('notesEn', value)}
                  />
                </FormGroup>

                <FormGroup>
                  <TextInput
                    label={i18n.t('admin.recipes.form.ingredientsInfo.notesEs')}
                    value={formData.notesEs}
                    onChangeText={(value) => handleChange('notesEs', value)}
                  />
                </FormGroup>
              </FormRow>

              <FormDivider />

              {/* Tips */}
              <FormRow column>
                <View className="flex-row items-baseline gap-sm">
                  <Text preset="subheading">
                    {i18n.t('admin.recipes.form.ingredientsInfo.tipTitle')}
                  </Text>
                </View>
                <FormGroup>
                  <TextInput
                    label={i18n.t('admin.recipes.form.ingredientsInfo.tipEn')}
                    value={formData.tipEn}
                    onChangeText={(value) => handleChange('tipEn', value)}
                    multiline={true}
                    numberOfLines={4}
                    className="min-h-[100px] p-md"
                    style={{ textAlignVertical: 'top' }}
                  />
                </FormGroup>

                <FormGroup>
                  <TextInput
                    label={i18n.t('admin.recipes.form.ingredientsInfo.tipEs')}
                    value={formData.tipEs}
                    onChangeText={(value) => handleChange('tipEs', value)}
                    multiline={true}
                    numberOfLines={4}
                    className="min-h-[100px] p-md"
                    style={{ textAlignVertical: 'top' }}
                  />
                </FormGroup>
              </FormRow>

              <FormDivider />

              <FormRow>
                <FormGroup required>
                  <TextInput
                    label={i18n.t('admin.recipes.form.ingredientsInfo.recipeSectionEn')}
                    value={formData.recipeSectionEn}
                    onChangeText={(value) => handleChange('recipeSectionEn', value)}
                    error={errors.recipeSectionEn}
                  />
                </FormGroup>
                <FormGroup required>
                  <TextInput
                    label={i18n.t('admin.recipes.form.ingredientsInfo.recipeSectionEs')}
                    value={formData.recipeSectionEs}
                    onChangeText={(value) => handleChange('recipeSectionEs', value)}
                    error={errors.recipeSectionEs}
                  />
                </FormGroup>
              </FormRow>

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