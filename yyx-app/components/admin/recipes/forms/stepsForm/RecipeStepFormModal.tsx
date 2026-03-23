import React, { useState, useEffect } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FormGroup } from '@/components/form/FormGroup';
import { FormRow } from '@/components/form/FormRow';
import { Text } from '@/components/common/Text';
import { TextInput } from '@/components/form/TextInput';
import { SelectInput } from '@/components/form/SelectInput';
import { Button } from '@/components/common/Button';
import { AdminRecipeSteps, AdminRecipeIngredient, AdminMeasurementUnit, AdminRecipeStepTranslation, pickTranslation, getTranslatedField } from '@/types/recipe.admin.types';
import { ThermomixSpeed, ThermomixSettings } from '@/types/thermomix.types';
import i18n from '@/i18n';
import { Image } from 'expo-image';
import { adminRecipeService } from '@/services/admin/adminRecipeService';
import { ThermomixInput } from '@/components/form/ThermomixInput';
import { useDevice } from '@/hooks/useDevice';
import { COLORS } from '@/constants/design-tokens';
import { useActiveLocales } from '@/hooks/admin/useActiveLocales';
import { translateContent } from '@/services/admin/adminTranslateService';

interface StepFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (recipeStep: AdminRecipeSteps) => void;
  recipeStep: AdminRecipeSteps;
  recipeIngredients: AdminRecipeIngredient[];
  recipeSteps: AdminRecipeSteps[];
  measurementUnits?: AdminMeasurementUnit[];
  authoringLocale?: string;
}

type ValidationErrors = Record<string, string>;

const StepFormModal: React.FC<StepFormModalProps> = ({
  visible,
  onClose,
  onSave,
  recipeStep,
  recipeIngredients,
  recipeSteps,
  measurementUnits = [],
  authoringLocale = 'es'
}) => {
  const { isLarge: isLargeScreen, isSmall: isSmallScreen } = useDevice();
  // Form labels follow the authoring locale so the admin sees labels in the language they're editing
  const tForm = (key: string, opts?: any) => i18n.t(key, { ...opts, locale: authoringLocale });
  const [formData, setFormData] = useState<AdminRecipeSteps>(recipeStep);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [showFormatHelp, setShowFormatHelp] = useState(false);

  // Group ingredients by section
  const groupedRecipeIngredients = React.useMemo(() => {
    const grouped: Record<string, AdminRecipeIngredient[]> = {};

    recipeIngredients.forEach(ingredient => {
      const section = getTranslatedField(ingredient.translations, authoringLocale, 'recipeSection') || 'Main';
      if (!grouped[section]) {
        grouped[section] = [];
      }
      grouped[section].push(ingredient);
    });

    return grouped;
  }, [recipeIngredients, authoringLocale]);

  // Memoize the measurement units if not provided via props
  const [cachedMeasurementUnits, setCachedMeasurementUnits] = useState<AdminMeasurementUnit[]>([]);

  // Fetch measurement units if needed
  useEffect(() => {
    if (measurementUnits.length === 0 && cachedMeasurementUnits.length === 0) {
      const fetchMeasurementUnits = async () => {
        try {
          const units = await adminRecipeService.getAllMeasurementUnits();
          setCachedMeasurementUnits(units);
        } catch (error) {
        }
      };

      fetchMeasurementUnits();
    }
  }, [measurementUnits, cachedMeasurementUnits]);

  // Use provided units or cached units
  const availableMeasurementUnits = measurementUnits.length > 0
    ? measurementUnits
    : cachedMeasurementUnits;

  useEffect(() => {
    if (recipeStep && visible) {
      setFormData(recipeStep);

      // Ensure ingredients have proper display order
      if (recipeStep.ingredients && recipeStep.ingredients.length > 0) {
        const sortedIngredients = [...recipeStep.ingredients].sort((a, b) =>
          (a.displayOrder || 0) - (b.displayOrder || 0)
        );

        const needsUpdate = sortedIngredients.some((ing, index) => ing.displayOrder !== index);
        if (needsUpdate) {
          const updatedIngredients = sortedIngredients.map((ing, index) => ({
            ...ing,
            displayOrder: index
          }));
          setFormData(prev => ({
            ...prev,
            ingredients: updatedIngredients
          }));
        }
      }

      setErrors({});
    }
  }, [recipeStep, visible]);

  // Translation helpers
  const getStepTransField = (locale: string, field: string): string => {
    const t = pickTranslation(formData.translations, locale);
    return (t as any)?.[field] || '';
  };

  const setStepTransField = (locale: string, field: string, value: string) => {
    const existing = formData.translations.find(t => t.locale === locale);
    let updated: AdminRecipeStepTranslation[];
    if (existing) {
      updated = formData.translations.map(t =>
        t.locale === locale ? { ...t, [field]: value } : t
      );
    } else {
      updated = [...formData.translations, { locale, instruction: '', [field]: value } as AdminRecipeStepTranslation];
    }
    setFormData(prev => ({ ...prev, translations: updated }));
  };

  const calculateRemainingIngredientQuantity = (ingredientId: string): number | undefined => {
    const ingredient = recipeIngredients.find(ing => ing.ingredientId === ingredientId);
    if (!ingredient) return undefined;

    const totalQuantity = ingredient.quantity || 0;
    const stepsUsingIngredient = recipeSteps
      .filter(recipeStep =>
        (recipeStep.ingredients || []).some(ing => ing.ingredientId === ingredientId)
      );

    const usedQuantity = stepsUsingIngredient
      .reduce((sum, recipeStep) => {
        const usedIngredient = (recipeStep.ingredients || [])
          .find(ing => ing.ingredientId === ingredientId);
        const quantityInThisStep = usedIngredient?.quantity || 0;
        return sum + Number(quantityInThisStep);
      }, 0);

    return Math.max(0, Number(totalQuantity) - Number(usedQuantity));
  };

  const handleChange = (key: keyof AdminRecipeSteps, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleMoveIngredient = (recipeStepIngredientId: string, direction: 'up' | 'down') => {
    setFormData(prev => {
      const currentIngredients = [...(prev.ingredients || [])];
      const currentIndex = currentIngredients.findIndex(ing => ing.ingredientId === recipeStepIngredientId);
      if (currentIndex === -1) return prev;

      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= currentIngredients.length) return prev;

      const temp = currentIngredients[currentIndex];
      currentIngredients[currentIndex] = currentIngredients[newIndex];
      currentIngredients[newIndex] = temp;

      currentIngredients.forEach((ingredient, index) => {
        ingredient.displayOrder = index;
      });

      return { ...prev, ingredients: currentIngredients };
    });
  };

  const handleIngredientToggle = (recipeIngredient: AdminRecipeIngredient) => {
    setFormData(prev => {
      const currentIngredients = prev.ingredients || [];
      const isSelected = currentIngredients.some(ing => ing.ingredientId === recipeIngredient.ingredientId);

      if (isSelected) {
        const filteredIngredients = currentIngredients.filter(
          ing => ing.ingredientId !== recipeIngredient.ingredientId
        );
        filteredIngredients.forEach((ing, index) => { ing.displayOrder = index; });
        return { ...prev, ingredients: filteredIngredients };
      } else {
        const remainingQuantity = calculateRemainingIngredientQuantity(recipeIngredient.ingredientId);
        const recipeIngredientCopy = {
          ...recipeIngredient,
          recipeId: '',
          recipeStepId: recipeStep.id,
          measurementUnitId: recipeIngredient.measurementUnit?.id || '',
          displayOrder: currentIngredients.length
        };

        if (remainingQuantity !== undefined) {
          recipeIngredientCopy.quantity = remainingQuantity.toString();
        }

        return { ...prev, ingredients: [...currentIngredients, recipeIngredientCopy] };
      }
    });
  };

  const handleIngredientQuantityChange = (ingredientId: string, newQuantity: string) => {
    setFormData(prev => {
      const currentRecipeIngredients = [...(prev.ingredients || [])];
      const index = currentRecipeIngredients.findIndex(ing => ing.ingredientId === ingredientId);

      if (index !== -1) {
        currentRecipeIngredients[index] = { ...currentRecipeIngredients[index], quantity: newQuantity };
      }
      return { ...prev, ingredients: currentRecipeIngredients };
    });
  };

  const handleMeasurementUnitChange = (ingredientId: string, unitId: string) => {
    setFormData(prev => {
      const currentIngredients = [...(prev.ingredients || [])];
      const index = currentIngredients.findIndex(ing => ing.ingredientId === ingredientId);

      if (index !== -1) {
        const selectedUnit = availableMeasurementUnits.find(unit => unit.id === unitId);
        if (selectedUnit) {
          currentIngredients[index] = { ...currentIngredients[index], measurementUnit: selectedUnit };
        }
      }
      return { ...prev, ingredients: currentIngredients };
    });
  };

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    const hasInstruction = formData.translations.some(t => t.instruction?.trim());
    if (!hasInstruction) {
      newErrors.recipeStep = i18n.t('validation.required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSave(formData);
    }
  };

  const formatHelpItems = [
    { title: tForm('admin.recipes.form.stepsInfo.boldText'), example: '**text**', description: tForm('admin.recipes.form.stepsInfo.boldTextDescription') },
    { title: tForm('admin.recipes.form.stepsInfo.newLine'), example: '|', description: tForm('admin.recipes.form.stepsInfo.newLineDescription') },
    { title: tForm('admin.recipes.form.stepsInfo.thermomixParams'), example: '%thermomix%', description: tForm('admin.recipes.form.stepsInfo.thermomixParamsDescription') },
    { title: tForm('admin.recipes.form.stepsInfo.bulletPoint'), example: '{•}text{/•}', description: tForm('admin.recipes.form.stepsInfo.bulletPointDescription') }
  ];

  const getThermomixSpeedObject = (formData: AdminRecipeSteps): ThermomixSpeed => {
    if (formData.thermomixSpeed) return formData.thermomixSpeed;
    return null;
  };

  const extractSpeedValues = (speed: ThermomixSpeed | undefined) => ({
    thermomixSpeed: speed || null,
    thermomixSpeedStart: null,
    thermomixSpeedEnd: null
  });

  // Get ingredient display names from translations
  const getIngredientName = (ingredient: any, locale: string): string => {
    return getTranslatedField(ingredient?.translations, locale, 'name') || '';
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-center items-center">
        <View className={`bg-background-default rounded-lg shadow-md max-w-[900px] ${isSmallScreen ? 'max-h-[95%] w-[95%]' : isLargeScreen ? 'max-h-[90%] w-[70%]' : 'max-h-[90%] w-[80%]'}`}>
          <View className="flex-row justify-between items-center p-md border-b border-border-default">
            <Text preset="subheading" fontWeight="600">
              {formData.id === recipeStep.id
                ? tForm('admin.recipes.form.stepsInfo.editStep')
                : tForm('admin.recipes.form.stepsInfo.addStep')}
            </Text>
            <TouchableOpacity onPress={onClose} className="p-xs">
              <Ionicons name="close" size={24} className="text-text-DEFAULT" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
            <View className="flex-row justify-between flex-wrap items-baseline">
              <View className="mt-lg mb-sm">
                <Text preset="h1">
                  {tForm('admin.recipes.form.stepsInfo.instruction')}
                </Text>
              </View>
              <TouchableOpacity
                className="flex-row items-center justify-start py-sm gap-xs"
                onPress={() => setShowFormatHelp(!showFormatHelp)}
              >
                <Text preset="subheading">
                  {showFormatHelp ?
                    tForm('admin.recipes.form.stepsInfo.hideFormattingHelp', { defaultValue: 'Hide Formatting Help' }) :
                    tForm('admin.recipes.form.stepsInfo.showFormattingHelp', { defaultValue: 'Show Formatting Help' })
                  }
                </Text>
                <Ionicons
                  name={showFormatHelp ? "chevron-up" : "chevron-down"}
                  size={20}
                  className="text-primary-DEFAULT"
                />
              </TouchableOpacity>
              {showFormatHelp ? (
                <View className="mb-lg w-full">
                  <View className={`flex-row flex-wrap gap-md mt-sm px-sm ${isSmallScreen ? 'flex-col' : ''}`}>
                    {formatHelpItems.map((item, index) => (
                      <View key={index} className={`flex-col gap-xs ${isSmallScreen ? 'w-full flex-none' : 'flex-1 min-w-[200px] max-w-[300px]'}`}>
                        <Text preset="caption" fontWeight="700">{item.title}</Text>
                        <View className="bg-background-SECONDARY p-xs rounded-sm">
                          <Text preset="caption" style={{ fontFamily: 'monospace' }}>{item.example}</Text>
                        </View>
                        <Text preset="caption">{item.description}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>

            {/* Instruction - single language */}
            <FormRow column>
              <FormGroup
                label={tForm('admin.recipes.form.stepsInfo.instruction')}
                required
                error={errors.recipeStep}
              >
                <TextInput
                  value={getStepTransField(authoringLocale, 'instruction')}
                  onChangeText={(text) => setStepTransField(authoringLocale, 'instruction', text)}
                  multiline
                  numberOfLines={5}
                />
              </FormGroup>
            </FormRow>

            {/* Ingredients Selection */}
            {recipeIngredients.length > 0 ? (
              <FormRow column style={{ gap: 0 }}>
                <View className="mt-lg mb-sm">
                  <Text preset="subheading" fontWeight="600">
                    {tForm('admin.recipes.form.stepsInfo.stepIngredients')}
                  </Text>
                  <Text preset="caption" className="mt-[2px] text-text-SECONDARY">
                    {tForm('admin.recipes.form.stepsInfo.stepIngredientsHelperText')}
                  </Text>
                </View>

                <View className="p-md border border-border-DEFAULT rounded-md mb-md">
                  {Object.entries(groupedRecipeIngredients).map(([section, sectionIngredients]) => (
                    <View key={section} className="flex-col gap-md mb-md">
                      <View className="mb-md pb-xs border-b border-border-DEFAULT">
                        <Text preset="body" fontWeight="700">{section}</Text>
                      </View>
                      {sectionIngredients
                        .sort((a, b) => {
                          const aSelected = (formData.ingredients || []).some(ing => ing.ingredientId === a.ingredientId);
                          const bSelected = (formData.ingredients || []).some(ing => ing.ingredientId === b.ingredientId);
                          if (aSelected && bSelected) {
                            const aIng = formData.ingredients?.find(ing => ing.ingredientId === a.ingredientId);
                            const bIng = formData.ingredients?.find(ing => ing.ingredientId === b.ingredientId);
                            return (aIng?.displayOrder || 0) - (bIng?.displayOrder || 0);
                          }
                          return aSelected ? -1 : bSelected ? 1 : 0;
                        })
                        .map((ri, index) => {
                          const isSelected = (formData.ingredients || []).some(
                            fi => fi.ingredientId === ri.ingredientId
                          );
                          const selectedIngredient = isSelected
                            ? (formData.ingredients || []).find(ing => ing.ingredientId === ri.ingredientId)
                            : ri;

                          return (
                            <View key={`${ri.id}-${index}`} className={`flex-col sm:flex-row justify-between items-center sm:items-start p-sm mb-xs border border-border-default rounded-sm bg-background-default ${isSelected ? 'border-primary-dark bg-primary-light' : ''}`}>
                              <TouchableOpacity
                                onPress={() => handleIngredientToggle(ri)}
                                className="w-full sm:flex-1 flex-row items-center p-sm">
                                <Ionicons
                                  name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                                  size={24}
                                  color={isSelected ? COLORS.primary.dark : COLORS.text.secondary}
                                  className="mr-sm"
                                />
                                <View className="w-12 h-12 rounded-sm overflow-hidden mr-sm bg-background-SECONDARY items-center justify-center">
                                  {ri.ingredient.pictureUrl ? (
                                    <Image source={ri.ingredient.pictureUrl} className="w-full h-full" contentFit="contain" transition={300} cachePolicy="memory-disk" />
                                  ) : (
                                    <Ionicons name="image-outline" size={20} color={COLORS.text.secondary} />
                                  )}
                                </View>
                                <View className="flex-1">
                                  <Text preset="body" className="leading-6 mb-xs">{getIngredientName(ri.ingredient, authoringLocale)}</Text>
                                </View>
                              </TouchableOpacity>

                              {isSelected ? (
                                <View className={`w-full sm:w-auto sm:flex-1 flex-row items-start justify-end p-sm sm:border-l border-border-default sm:pl-sm sm:ml-sm ${isSmallScreen ? 'border-t mt-xs pt-md' : ''}`}>
                                  <View className="w-[80px] mr-sm shrink-0">
                                    <TextInput
                                      value={selectedIngredient?.quantity?.toString() || ''}
                                      onChangeText={(text) => handleIngredientQuantityChange(ri.ingredientId, text)}
                                      keyboardType="decimal-pad"
                                      numericOnly={true}
                                      allowDecimal={true}
                                      label={tForm('admin.recipes.form.ingredientsInfo.quantity')}
                                    />
                                  </View>
                                  <View className="flex-1 min-w-0">
                                    <SelectInput
                                      label={tForm('admin.recipes.form.ingredientsInfo.measurementUnit')}
                                      value={selectedIngredient?.measurementUnit?.id || ''}
                                      options={availableMeasurementUnits.map((unit) => ({
                                        label: getTranslatedField(unit.translations, authoringLocale, 'symbol'),
                                        value: unit.id,
                                      }))}
                                      onValueChange={(value) => handleMeasurementUnitChange(selectedIngredient?.ingredientId || '', value)}
                                      error={errors.measurementUnit}
                                    />
                                  </View>
                                  <View className="items-center ml-md">
                                    <View className="flex-col items-center gap-xs">
                                      <TouchableOpacity
                                        onPress={() => handleMoveIngredient(ri.ingredientId, 'up')}
                                        disabled={selectedIngredient?.displayOrder === 0}
                                        className={`p-xs ${selectedIngredient?.displayOrder === 0 ? 'opacity-50' : ''}`}
                                      >
                                        <Ionicons name="chevron-up" size={20} color={selectedIngredient?.displayOrder === 0 ? COLORS.text.secondary : COLORS.text.default} />
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        onPress={() => handleMoveIngredient(ri.ingredientId, 'down')}
                                        disabled={selectedIngredient?.displayOrder === (formData.ingredients?.length || 0) - 1}
                                        className={`p-xs ${selectedIngredient?.displayOrder === (formData.ingredients?.length || 0) - 1 ? 'opacity-50' : ''}`}
                                      >
                                        <Ionicons name="chevron-down" size={20} color={selectedIngredient?.displayOrder === (formData.ingredients?.length || 0) - 1 ? COLORS.text.secondary : COLORS.text.default} />
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                </View>
                              ) : null}
                            </View>
                          );
                        })}
                    </View>
                  ))}
                </View>
              </FormRow>
            ) : null}

            {/* Thermomix Parameters */}
            <View className="mt-lg mb-sm">
              <Text preset="subheading" fontWeight="600">
                {tForm('admin.recipes.form.stepsInfo.thermomixParameters')}
              </Text>
              <Text preset="caption" className="mt-[2px] text-text-SECONDARY">
                {tForm('admin.recipes.form.stepsInfo.thermomixHelperText')}
              </Text>
            </View>

            <FormRow>
              <ThermomixInput
                initialValues={{
                  time: formData.thermomixTime || null,
                  temperature: formData.thermomixTemperature || null,
                  temperatureUnit: formData.thermomixTemperatureUnit || null,
                  speed: getThermomixSpeedObject(formData),
                  isBladeReversed: formData.thermomixIsBladeReversed || null,
                  mode: (formData.thermomixMode as ThermomixSettings['mode']) || null
                }}
                onChange={(settings: Partial<ThermomixSettings>) => {
                  setFormData(prev => {
                    const { thermomixSpeed } = extractSpeedValues(settings.speed);
                    return {
                      ...prev,
                      thermomixTime: settings.time,
                      thermomixTemperature: settings.temperature,
                      thermomixTemperatureUnit: settings.temperatureUnit,
                      thermomixSpeed,
                      thermomixIsBladeReversed: settings.isBladeReversed,
                      thermomixMode: settings.mode || null
                    };
                  });
                }}
              />
            </FormRow>

            {/* Tip - single language */}
            <View className="mt-lg mb-sm">
              <Text preset="subheading" fontWeight="600">
                {tForm('admin.recipes.form.stepsInfo.tipTitle')}
              </Text>
            </View>

            <FormRow column>
              <FormGroup label={tForm('admin.recipes.form.stepsInfo.tipTitle')}>
                <TextInput
                  value={getStepTransField(authoringLocale, 'tip')}
                  onChangeText={(text) => setStepTransField(authoringLocale, 'tip', text)}
                  multiline
                  numberOfLines={3}
                />
              </FormGroup>
            </FormRow>

            {/* Recipe Section - single language */}
            <View className="mt-lg mb-sm">
              <Text preset="subheading" fontWeight="600">
                {tForm('admin.recipes.form.stepsInfo.recipeSection')}
              </Text>
            </View>

            <FormRow column>
              <FormGroup label={tForm('admin.recipes.form.stepsInfo.recipeSection')}>
                <TextInput
                  value={getStepTransField(authoringLocale, 'recipeSection')}
                  onChangeText={(text) => setStepTransField(authoringLocale, 'recipeSection', text)}
                />
              </FormGroup>
            </FormRow>

            {/* Actions */}
            <View className="flex-row justify-end gap-md mt-lg">
              <Button
                label={i18n.t('admin.recipes.form.cancel')}
                onPress={onClose}
                variant="outline"
                className="min-w-[120px]"
              />
              <Button
                label={i18n.t('admin.recipes.form.save')}
                onPress={handleSubmit}
                variant="primary"
                className="min-w-[120px]"
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal >
  );
};

export default StepFormModal;
