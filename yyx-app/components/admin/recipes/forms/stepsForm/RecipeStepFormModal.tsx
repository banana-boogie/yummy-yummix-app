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
import { AdminRecipeSteps, AdminRecipeIngredient, AdminMeasurementUnit } from '@/types/recipe.admin.types';
import { ThermomixSpeed, ThermomixSettings } from '@/types/thermomix.types';
import i18n from '@/i18n';
import { Image } from 'expo-image';
import { adminRecipeService } from '@/services/admin/adminRecipeService';
import { LanguageBadge } from '@/components/common/LanguageBadge';
import { ThermomixInput } from '@/components/form/ThermomixInput';
import { useDevice } from '@/hooks/useDevice';
import { COLORS } from '@/constants/design-tokens';

interface StepFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (recipeStep: AdminRecipeSteps) => void;
  recipeStep: AdminRecipeSteps;
  recipeIngredients: AdminRecipeIngredient[];
  recipeSteps: AdminRecipeSteps[];
  measurementUnits?: AdminMeasurementUnit[];
}

type ValidationErrors = Record<string, string>;

const StepFormModal: React.FC<StepFormModalProps> = ({
  visible,
  onClose,
  onSave,
  recipeStep,
  recipeIngredients,
  recipeSteps,
  measurementUnits = []
}) => {
  const { isLarge: isLargeScreen, isSmall: isSmallScreen } = useDevice();
  const [formData, setFormData] = useState<AdminRecipeSteps>(recipeStep);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [showFormatHelp, setShowFormatHelp] = useState(false);

  // Group ingredients by section
  const groupedRecipeIngredients = React.useMemo(() => {
    const grouped: Record<string, AdminRecipeIngredient[]> = {};

    recipeIngredients.forEach(ingredient => {
      const section = ingredient.recipeSectionEn || 'Main';
      if (!grouped[section]) {
        grouped[section] = [];
      }
      grouped[section].push(ingredient);
    });

    return grouped;
  }, [recipeIngredients]);

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

        // Update display order if needed
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

  const calculateRemainingIngredientQuantity = (ingredientId: string): number | undefined => {
    // Find the ingredient in recipeIngredients to get the total quantity
    const ingredient = recipeIngredients.find(ing => ing.ingredientId === ingredientId);

    if (!ingredient) {
      return undefined;
    }

    // Total quantity from the recipe's ingredient list
    const totalQuantity = ingredient.quantity || 0;
    const stepsUsingIngredient = recipeSteps
      .filter(recipeStep => {
        // Find all steps that use this ingredient
        return (recipeStep.ingredients || []).some(ing => ing.ingredientId === ingredientId)
      }
      );

    const usedQuantity = stepsUsingIngredient
      .reduce((sum, recipeStep) => {
        // Find the ingredient in this recipeStep
        const usedIngredient = (recipeStep.ingredients || [])
          .find(ing => ing.ingredientId === ingredientId);
        const quantityInThisStep = usedIngredient?.quantity || 0;

        // Add its quantity to our running sum
        return sum + Number(quantityInThisStep);
      }, 0);

    // Calculate remaining quantity
    const remainingQuantity = Math.max(0, Number(totalQuantity) - Number(usedQuantity));

    return remainingQuantity;
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
      // Check bounds
      if (newIndex < 0 || newIndex >= currentIngredients.length) return prev;

      // Swap ingredients
      const temp = currentIngredients[currentIndex];
      currentIngredients[currentIndex] = currentIngredients[newIndex];
      currentIngredients[newIndex] = temp;

      // Update display orders
      currentIngredients.forEach((ingredient, index) => {
        ingredient.displayOrder = index;
      });

      return {
        ...prev,
        ingredients: currentIngredients
      };
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

        // Reorder remaining ingredients
        filteredIngredients.forEach((ing, index) => {
          ing.displayOrder = index;
        });

        return {
          ...prev,
          ingredients: filteredIngredients
        };
      } else {
        const remainingQuantity = calculateRemainingIngredientQuantity(recipeIngredient.ingredientId);
        const recipeIngredientCopy = {
          ...recipeIngredient,
          recipeId: '',
          recipeStepId: recipeStep.id,
          measurementUnitId: recipeIngredient.measurementUnit?.id || '',
          displayOrder: currentIngredients.length // Set display order to last position
        };

        if (remainingQuantity !== undefined) {
          recipeIngredientCopy.quantity = remainingQuantity.toString();
        }

        return {
          ...prev,
          ingredients: [...currentIngredients, recipeIngredientCopy]
        };
      }
    });
  };

  const handleIngredientQuantityChange = (
    ingredientId: string,
    newQuantity: string
  ) => {
    setFormData(prev => {
      const currentRecipeIngredients = [...(prev.ingredients || [])];
      const index = currentRecipeIngredients.findIndex(ing => ing.ingredientId === ingredientId);

      if (index !== -1) {
        currentRecipeIngredients[index] = {
          ...currentRecipeIngredients[index],
          quantity: newQuantity
        };
      }

      return {
        ...prev,
        ingredients: currentRecipeIngredients
      };
    });
  };

  const handleMeasurementUnitChange = (
    ingredientId: string,
    unitId: string
  ) => {
    setFormData(prev => {
      const currentIngredients = [...(prev.ingredients || [])];
      const index = currentIngredients.findIndex(ing => ing.ingredientId === ingredientId);

      if (index !== -1) {
        const selectedUnit = availableMeasurementUnits.find(unit => unit.id === unitId);

        if (selectedUnit) {
          currentIngredients[index] = {
            ...currentIngredients[index],
            measurementUnit: selectedUnit,
          };
        }
      }

      return {
        ...prev,
        ingredients: currentIngredients
      };
    });
  };

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    if (!formData.instructionEn && !formData.instructionEs) {
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
    { title: i18n.t('admin.recipes.form.stepsInfo.boldText'), example: '**text**', description: i18n.t('admin.recipes.form.stepsInfo.boldTextDescription') },
    { title: i18n.t('admin.recipes.form.stepsInfo.newLine'), example: '|', description: i18n.t('admin.recipes.form.stepsInfo.newLineDescription') },
    { title: i18n.t('admin.recipes.form.stepsInfo.thermomixParams'), example: '%thermomix%', description: i18n.t('admin.recipes.form.stepsInfo.thermomixParamsDescription') },
    { title: i18n.t('admin.recipes.form.stepsInfo.bulletPoint'), example: '{•}text{/•}', description: i18n.t('admin.recipes.form.stepsInfo.bulletPointDescription') }
  ];

  const getThermomixSpeedObject = (formData: AdminRecipeSteps): ThermomixSpeed => {
    if (formData.thermomixSpeed) {
      return formData.thermomixSpeed;
    }
    return null;
  };

  const extractSpeedValues = (speed: ThermomixSpeed | undefined): {
    thermomixSpeed: ThermomixSpeed,
    thermomixSpeedStart: null,
    thermomixSpeedEnd: null
  } => {
    if (!speed) {
      return {
        thermomixSpeed: null,
        thermomixSpeedStart: null,
        thermomixSpeedEnd: null
      };
    }

    return {
      thermomixSpeed: speed,
      thermomixSpeedStart: null,
      thermomixSpeedEnd: null
    };
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
                ? i18n.t('admin.recipes.form.stepsInfo.editStep')
                : i18n.t('admin.recipes.form.stepsInfo.addStep')}
            </Text>
            <TouchableOpacity onPress={onClose} className="p-xs">
              <Ionicons name="close" size={24} className="text-text-DEFAULT" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
            <View className="flex-row justify-between flex-wrap items-baseline">
              {/* Steps */}
              <View className="mt-lg mb-sm">
                <Text preset="h1">
                  {i18n.t('admin.recipes.form.stepsInfo.instruction')}
                </Text>
              </View>
              {/* Formatting Help Toggle Button */}
              <TouchableOpacity
                className="flex-row items-center justify-start py-sm gap-xs"
                onPress={() => setShowFormatHelp(!showFormatHelp)}
              >
                <Text preset="subheading">
                  {showFormatHelp ?
                    i18n.t('admin.recipes.form.stepsInfo.hideFormattingHelp', { defaultValue: 'Hide Formatting Help' }) :
                    i18n.t('admin.recipes.form.stepsInfo.showFormattingHelp', { defaultValue: 'Show Formatting Help' })
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

            <FormRow column>
              <FormGroup
                label={i18n.t('admin.recipes.form.stepsInfo.instructionHeadingEn')}
                required
                error={errors.recipeStep}
              >
                <TextInput
                  value={formData.instructionEn || ''}
                  onChangeText={(text) => handleChange('instructionEn', text)}
                  multiline
                  numberOfLines={5}
                />
              </FormGroup>

              <FormGroup
                label={i18n.t('admin.recipes.form.stepsInfo.instructionHeadingEs')}
                required
                error={errors.recipeStep}
              >
                <TextInput
                  value={formData.instructionEs || ''}
                  onChangeText={(text) => handleChange('instructionEs', text)}
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
                    {i18n.t('admin.recipes.form.stepsInfo.stepIngredients')}
                  </Text>
                  <Text preset="caption" className="mt-[2px] text-text-SECONDARY">
                    {i18n.t('admin.recipes.form.stepsInfo.stepIngredientsHelperText')}
                  </Text>
                </View>

                <View className="p-md border border-border-DEFAULT rounded-md mb-md">
                  {Object.entries(groupedRecipeIngredients).map(([section, recipeIngredients]) => (
                    <View key={section} className="flex-col gap-md mb-md">
                      <View className="mb-md pb-xs border-b border-border-DEFAULT">
                        <Text preset="body" fontWeight="700">
                          {section}
                        </Text>
                      </View>
                      {recipeIngredients
                        .sort((a, b) => {
                          const aSelected = (formData.ingredients || []).some(ing => ing.ingredientId === a.ingredientId);
                          const bSelected = (formData.ingredients || []).some(ing => ing.ingredientId === b.ingredientId);

                          if (aSelected && bSelected) {
                            const aIngredient = formData.ingredients?.find(ing => ing.ingredientId === a.ingredientId);
                            const bIngredient = formData.ingredients?.find(ing => ing.ingredientId === b.ingredientId);
                            return (aIngredient?.displayOrder || 0) - (bIngredient?.displayOrder || 0);
                          }

                          return aSelected ? -1 : bSelected ? 1 : 0;
                        })
                        .map((recipeIngredient, index) => {
                          const isSelected = (formData.ingredients || []).some(
                            formRecipeIngredient => formRecipeIngredient.ingredientId === recipeIngredient.ingredientId
                          );

                          const selectedIngredient = isSelected
                            ? (formData.ingredients || []).find(ing => ing.ingredientId === recipeIngredient.ingredientId)
                            : recipeIngredient;

                          return (
                            <View key={`${recipeIngredient.id}-${index}`} className={`flex-col sm:flex-row justify-between items-center sm:items-start p-sm mb-xs border border-border-default rounded-sm bg-background-default ${isSelected ? 'border-primary-dark bg-primary-light' : ''}`}>
                              {/* Ingredient Card */}
                              <TouchableOpacity
                                onPress={() => handleIngredientToggle(recipeIngredient)}
                                className="w-full sm:flex-1 flex-row items-center p-sm">

                                <Ionicons
                                  name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                                  size={24}
                                  color={isSelected ? COLORS.primary.dark : COLORS.text.secondary}
                                  className="mr-sm"
                                />

                                <View className="w-12 h-12 rounded-sm overflow-hidden mr-sm bg-background-SECONDARY items-center justify-center">
                                  {recipeIngredient.ingredient.pictureUrl ? (
                                    <Image
                                      source={recipeIngredient.ingredient.pictureUrl}
                                      className="w-full h-full"
                                      contentFit="contain"
                                      transition={300}
                                      cachePolicy="memory-disk"
                                    />
                                  ) : (
                                    <Ionicons name="image-outline" size={20} color={COLORS.text.secondary} />
                                  )}
                                </View>

                                <View className="flex-1">
                                  <View className="flex-row items-center gap-xs mb-xs">
                                    <LanguageBadge language="EN" />
                                    <Text preset="body" className="leading-6">{recipeIngredient.ingredient.nameEn}</Text>
                                  </View>
                                  <View className="flex-row items-center gap-xs mb-xs">
                                    <LanguageBadge language="ES" />
                                    <Text preset="body" className="leading-6">{recipeIngredient.ingredient.nameEs}</Text>
                                  </View>
                                </View>
                              </TouchableOpacity>

                              {/* Actions - Quantity and Unit */}
                              {
                                isSelected ? (
                                  <View className={`w-full sm:w-auto sm:flex-1 flex-row items-center justify-end p-sm sm:border-l border-border-default sm:pl-sm sm:ml-sm ${isSmallScreen ? 'border-t mt-xs pt-md' : ''}`}>
                                    <View className="flex-1 mr-xs">
                                      <TextInput
                                        value={selectedIngredient?.quantity?.toString() || ''}
                                        onChangeText={(text) => handleIngredientQuantityChange(recipeIngredient.ingredientId, text)}
                                        keyboardType="decimal-pad"
                                        numericOnly={true}
                                        allowDecimal={true}
                                        label={i18n.t('admin.recipes.form.ingredientsInfo.quantity')}
                                      />
                                    </View>

                                    <View className="flex-[2] mb-xs">
                                      <SelectInput
                                        label={i18n.t('admin.recipes.form.ingredientsInfo.measurementUnit')}
                                        value={selectedIngredient?.measurementUnit?.id || ''}
                                        options={availableMeasurementUnits.map((unit) => ({
                                          label: unit.symbolEn,
                                          value: unit.id,
                                        }))}
                                        onValueChange={(value) => handleMeasurementUnitChange(selectedIngredient?.ingredientId || '', value)}
                                        error={errors.measurementUnit}
                                      />
                                    </View>

                                    {/* Display Order Column */}
                                    <View className="items-center ml-md">
                                      <View className="flex-col items-center gap-xs">
                                        <TouchableOpacity
                                          onPress={() => handleMoveIngredient(recipeIngredient.ingredientId, 'up')}
                                          disabled={selectedIngredient?.displayOrder === 0}
                                          className={`p-xs ${selectedIngredient?.displayOrder === 0 ? 'opacity-50' : ''}`}
                                        >
                                          <Ionicons
                                            name="chevron-up"
                                            size={20}
                                            color={selectedIngredient?.displayOrder === 0 ? COLORS.text.secondary : COLORS.text.default}
                                          />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                          onPress={() => handleMoveIngredient(recipeIngredient.ingredientId, 'down')}
                                          disabled={selectedIngredient?.displayOrder === (formData.ingredients?.length || 0) - 1}
                                          className={`p-xs ${selectedIngredient?.displayOrder === (formData.ingredients?.length || 0) - 1 ? 'opacity-50' : ''}`}
                                        >
                                          <Ionicons
                                            name="chevron-down"
                                            size={20}
                                            color={selectedIngredient?.displayOrder === (formData.ingredients?.length || 0) - 1 ? COLORS.text.secondary : COLORS.text.default}
                                          />
                                        </TouchableOpacity>
                                      </View>
                                    </View>
                                  </View>
                                ) : null
                              }
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
                {i18n.t('admin.recipes.form.stepsInfo.thermomixParameters')}
              </Text>
              <Text preset="caption" className="mt-[2px] text-text-SECONDARY">
                {i18n.t('admin.recipes.form.stepsInfo.thermomixHelperText')}
              </Text>
            </View>

            {/* Thermomix Settings */}
            <FormRow>
              <ThermomixInput
                initialValues={{
                  time: formData.thermomixTime || null,
                  temperature: formData.thermomixTemperature || null,
                  temperatureUnit: formData.thermomixTemperatureUnit || null,
                  speed: getThermomixSpeedObject(formData),
                  isBladeReversed: formData.thermomixIsBladeReversed || null
                }}
                onChange={(settings: Partial<ThermomixSettings>) => {
                  setFormData(prev => {
                    const { thermomixSpeed } = extractSpeedValues(settings.speed);

                    const updatedData = {
                      ...prev,
                      thermomixTime: settings.time,
                      thermomixTemperature: settings.temperature,
                      thermomixTemperatureUnit: settings.temperatureUnit,
                      thermomixSpeed,
                      thermomixIsBladeReversed: settings.isBladeReversed
                    };

                    return updatedData;
                  });
                }}
              />
            </FormRow>

            {/* Add Tip section above Recipe Section */}
            <View className="mt-lg mb-sm">
              <Text preset="subheading" fontWeight="600">
                {i18n.t('admin.recipes.form.stepsInfo.tipTitle')}
              </Text>
            </View>

            <FormRow>
              <FormGroup label={i18n.t('admin.recipes.form.stepsInfo.tipEn')}>
                <TextInput
                  value={formData.tipEn || ''}
                  onChangeText={(text) => handleChange('tipEn', text)}
                  multiline
                  numberOfLines={3}
                />
              </FormGroup>

              <FormGroup label={i18n.t('admin.recipes.form.stepsInfo.tipEs')}>
                <TextInput
                  value={formData.tipEs || ''}
                  onChangeText={(text) => handleChange('tipEs', text)}
                  multiline
                  numberOfLines={3}
                />
              </FormGroup>
            </FormRow>

            {/* Recipe Section */}
            <View className="mt-lg mb-sm">
              <Text preset="subheading" fontWeight="600">
                {i18n.t('admin.recipes.form.stepsInfo.recipeSection')}
              </Text>
            </View>

            <FormRow>
              <FormGroup label={i18n.t('admin.recipes.form.stepsInfo.recipeSectionEn')}>
                <TextInput
                  value={formData.recipeSectionEn || ''}
                  onChangeText={(text) => handleChange('recipeSectionEn', text)}
                />
              </FormGroup>

              <FormGroup label={i18n.t('admin.recipes.form.stepsInfo.recipeSectionEs')}>
                <TextInput
                  value={formData.recipeSectionEs || ''}
                  onChangeText={(text) => handleChange('recipeSectionEs', text)}
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