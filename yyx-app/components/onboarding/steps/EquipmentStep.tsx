/**
 * Equipment Selection Step
 *
 * Thermomix-first design: Prominen display of Thermomix with model selection,
 * followed by other equipment options.
 */
import React, { useState, useEffect } from 'react';
import { View, ScrollView, Pressable, StyleProp, ViewStyle, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/common/Text';
import { COLORS } from '@/constants/design-tokens';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/i18n';
import { StepNavigationButtons } from '@/components/onboarding/StepNavigationButtons';
import { EQUIPMENT_CONFIG, type EquipmentType, type ThermomixModel } from '@/constants/equipment';
import type { KitchenEquipment } from '@/types/onboarding';

interface EquipmentStepProps {
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export function EquipmentStep({ className = '', style }: EquipmentStepProps) {
  const { formData, updateFormData, goToNextStep, goToPreviousStep } = useOnboarding();

  const [selectedEquipment, setSelectedEquipment] = useState<KitchenEquipment[]>(
    formData.kitchenEquipment ?? []
  );
  const [thermomixModels, setThermomixModels] = useState<ThermomixModel[]>(
    formData.kitchenEquipment
      ?.filter(e => e.type === 'thermomix' && e.model)
      .map(e => e.model!) ?? []
  );
  const [showModelError, setShowModelError] = useState(false);

  // Sync local state with formData changes
  useEffect(() => {
    if (formData.kitchenEquipment) {
      setSelectedEquipment(formData.kitchenEquipment);
      const models = formData.kitchenEquipment
        .filter(e => e.type === 'thermomix' && e.model)
        .map(e => e.model!);
      setThermomixModels(models);
    }
  }, [formData.kitchenEquipment]);

  const hasThermomix = selectedEquipment.some(e => e.type === 'thermomix');

  const toggleEquipment = (type: EquipmentType) => {
    const exists = selectedEquipment.some(e => e.type === type);

    let newEquipment: KitchenEquipment[];
    if (exists) {
      // Remove equipment
      newEquipment = selectedEquipment.filter(e => e.type !== type);
      if (type === 'thermomix') {
        setThermomixModels([]);
      }
    } else {
      // Add equipment (Thermomix entries are added via model selection)
      if (type === 'thermomix') {
        // Add a placeholder; models will be selected next
        newEquipment = [...selectedEquipment, { type }];
      } else {
        newEquipment = [...selectedEquipment, { type }];
      }
    }

    setSelectedEquipment(newEquipment);
    updateFormData({ kitchenEquipment: newEquipment });
  };

  const toggleThermomixModel = (model: ThermomixModel) => {
    setShowModelError(false);

    const isSelected = thermomixModels.includes(model);
    const newModels = isSelected
      ? thermomixModels.filter(m => m !== model)
      : [...thermomixModels, model];

    setThermomixModels(newModels);

    // Rebuild equipment: remove all thermomix entries, add one per selected model
    const nonThermomix = selectedEquipment.filter(e => e.type !== 'thermomix');
    const thermomixEntries: KitchenEquipment[] = newModels.map(m => ({
      type: 'thermomix' as const,
      model: m,
    }));
    // If models are selected, add one entry per model; otherwise keep a bare entry
    const newEquipment = newModels.length > 0
      ? [...nonThermomix, ...thermomixEntries]
      : [...nonThermomix, { type: 'thermomix' as const }];

    setSelectedEquipment(newEquipment);
    updateFormData({ kitchenEquipment: newEquipment });
  };

  const handleNext = () => {
    // Validate: if Thermomix is selected, at least one model must be chosen
    if (hasThermomix && thermomixModels.length === 0) {
      setShowModelError(true);
      return;
    }
    goToNextStep();
  };

  const handleBack = () => {
    goToPreviousStep();
  };

  // Equipment order: Thermomix first, then others
  const equipmentOrder: EquipmentType[] = ['thermomix', 'air_fryer'];
  const otherEquipment = equipmentOrder.filter(type => type !== 'thermomix');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
      style={style}
    >
      <ScrollView
        className={`flex-1 ${className}`}
        contentContainerStyle={{ paddingBottom: 20, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-lg">
          <Text preset="h2" className="text-center mb-sm">
            {i18n.t('onboarding.steps.equipment.title')}
          </Text>
          <Text preset="body" className="text-text-secondary text-center">
            {i18n.t('onboarding.steps.equipment.description')}
          </Text>
        </View>

        {/* SECTION 1: THERMOMIX (Prominent display) */}
        <View className="mb-xl">
          <Pressable
            onPress={() => toggleEquipment('thermomix')}
            className={`flex-row items-center p-lg rounded-xl border-2 ${
              hasThermomix
                ? 'bg-primary-lightest border-primary-medium'
                : 'bg-background-secondary border-transparent'
            }`}
          >
            <Image
              source={EQUIPMENT_CONFIG.thermomix.icon}
              style={{ width: 48, height: 48 }}
              contentFit="contain"
              className="mr-md"
            />
            <View className="flex-1">
              <Text preset="subheading">
                {i18n.t('onboarding.steps.equipment.thermomix.name')}
              </Text>
            </View>
            {hasThermomix && (
              <Ionicons name="checkmark-circle" size={24} color={COLORS.primary.medium} />
            )}
          </Pressable>

          {/* Thermomix model selection */}
          {hasThermomix && (
            <View className="mt-md mx-md">
              <Text preset="caption" className="mb-sm text-text-secondary">
                {i18n.t('onboarding.steps.equipment.thermomix.modelQuestion')}
              </Text>
              <View className="flex-row gap-md">
                {EQUIPMENT_CONFIG.thermomix.models.map(model => {
                  const isModelSelected = thermomixModels.includes(model);
                  return (
                    <Pressable
                      key={model}
                      onPress={() => toggleThermomixModel(model)}
                      className={`flex-row items-center px-lg py-md rounded-lg border-2 ${
                        isModelSelected
                          ? 'bg-primary-medium border-primary-medium'
                          : showModelError
                            ? 'bg-background-secondary border-status-error'
                            : 'bg-background-secondary border-transparent'
                      }`}
                    >
                      <Ionicons
                        name={isModelSelected ? 'checkbox' : 'square-outline'}
                        size={18}
                        color={isModelSelected ? COLORS.neutral.white : COLORS.text.secondary}
                        style={{ marginRight: 6 }}
                      />
                      <Text className={`font-semibold ${
                        isModelSelected ? 'text-white' : 'text-text-primary'
                      }`}>
                        {model}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {showModelError && (
                <Text preset="caption" className="text-status-error mt-sm">
                  {i18n.t('onboarding.steps.equipment.thermomix.modelRequired')}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Divider between sections */}
        <View className="my-lg mx-md">
          <View className="h-[1px] bg-grey-medium opacity-30" />
        </View>

        {/* SECTION 2: OTHER EQUIPMENT */}
        <View>
            {otherEquipment.map((type, index) => {
              const config = EQUIPMENT_CONFIG[type];
              const isSelected = selectedEquipment.some(e => e.type === type);

              return (
                <React.Fragment key={type}>
                  <Pressable
                    onPress={() => toggleEquipment(type)}
                    className={`flex-row items-center p-md rounded-lg ${
                      isSelected
                        ? 'bg-primary-lightest'
                        : 'bg-background-secondary'
                    }`}
                  >
                    <Image
                      source={config.icon}
                      style={{ width: 36, height: 36 }}
                      contentFit="contain"
                      className="mr-md"
                    />
                    <Text className="flex-1">
                      {i18n.t(`onboarding.steps.equipment.${type}.name`)}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.primary.medium} />
                    )}
                  </Pressable>
                  {/* Divider between equipment items, but not after the last one */}
                  {index < otherEquipment.length - 1 && (
                    <View className="my-md mx-md">
                      <View className="h-[1px] bg-grey-medium opacity-30" />
                    </View>
                  )}
                </React.Fragment>
              );
            })}
        </View>
      </ScrollView>

      <StepNavigationButtons
        onNext={handleNext}
        onBack={handleBack}
        nextLabel={i18n.t('onboarding.common.next')}
        backLabel={i18n.t('onboarding.common.back')}
      />
    </KeyboardAvoidingView>
  );
}
