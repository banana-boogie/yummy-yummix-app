/**
 * Equipment Selection Step
 *
 * Thermomix-first design: Prominen display of Thermomix with model selection,
 * followed by other equipment options.
 */
import React, { useState, useEffect } from 'react';
import { View, ScrollView, Pressable, StyleProp, ViewStyle, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from '@/components/common/Text';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/i18n';
import { StepNavigationButtons } from '@/components/onboarding/StepNavigationButtons';
import { EQUIPMENT_CONFIG, type EquipmentType, type ThermomixModel } from '@/constants/equipment';
import type { KitchenEquipment } from '@/types/onboarding';
import { cn } from '@/utils/cn';

interface EquipmentStepProps {
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export function EquipmentStep({ className = '', style }: EquipmentStepProps) {
  const { formData, updateFormData, goToNextStep, goToPreviousStep } = useOnboarding();

  const [selectedEquipment, setSelectedEquipment] = useState<KitchenEquipment[]>(
    formData.kitchenEquipment ?? []
  );
  const [thermomixModel, setThermomixModel] = useState<ThermomixModel | null>(
    formData.kitchenEquipment?.find(e => e.type === 'thermomix')?.model ?? null
  );

  // Sync local state with formData changes
  useEffect(() => {
    if (formData.kitchenEquipment) {
      setSelectedEquipment(formData.kitchenEquipment);
      const thermomix = formData.kitchenEquipment.find(e => e.type === 'thermomix');
      if (thermomix?.model) {
        setThermomixModel(thermomix.model);
      } else {
        setThermomixModel(null);
      }
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
        setThermomixModel(null);
      }
    } else {
      // Add equipment
      if (type === 'thermomix') {
        newEquipment = [...selectedEquipment, { type, model: thermomixModel ?? undefined }];
      } else {
        newEquipment = [...selectedEquipment, { type }];
      }
    }

    setSelectedEquipment(newEquipment);
    updateFormData({ kitchenEquipment: newEquipment });
  };

  const selectThermomixModel = (model: ThermomixModel) => {
    setThermomixModel(model);

    // Update the thermomix equipment with the selected model
    const newEquipment = selectedEquipment.map(e =>
      e.type === 'thermomix' ? { ...e, model } : e
    );

    setSelectedEquipment(newEquipment);
    updateFormData({ kitchenEquipment: newEquipment });
  };

  const handleNext = () => {
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
        className={cn('flex-1', className)}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-lg">
          <Text preset="h2" className="text-center mb-sm">
            {i18n.t('onboarding.equipment.title')}
          </Text>
          <Text preset="body" className="text-text-secondary text-center">
            {i18n.t('onboarding.equipment.description')}
          </Text>
        </View>

        {/* SECTION 1: THERMOMIX (Prominent display) */}
        <View className="mb-xl">
          <Text preset="subheading" className="mb-md">
            {i18n.t('onboarding.equipment.thermomix.title')}
          </Text>

          <Pressable
            onPress={() => toggleEquipment('thermomix')}
            className={cn(
              'flex-row items-center p-lg rounded-xl border-2',
              hasThermomix
                ? 'bg-primary-lightest border-primary-medium'
                : 'bg-background-secondary border-transparent'
            )}
          >
            <Text className="text-4xl mr-md">
              {EQUIPMENT_CONFIG.thermomix.icon}
            </Text>
            <View className="flex-1">
              <Text preset="subheading">
                {i18n.t('onboarding.equipment.thermomix.name')}
              </Text>
              <Text preset="caption" className="text-text-secondary">
                {i18n.t('onboarding.equipment.thermomix.description')}
              </Text>
            </View>
            {hasThermomix && (
              <Ionicons name="checkmark-circle" size={24} color="#FFBFB7" />
            )}
          </Pressable>

          {/* Thermomix model selection */}
          {hasThermomix && (
            <View className="mt-md ml-md">
              <Text preset="caption" className="mb-sm text-text-secondary">
                {i18n.t('onboarding.equipment.thermomix.modelQuestion')}
              </Text>
              <View className="flex-row gap-md">
                {EQUIPMENT_CONFIG.thermomix.models.map(model => (
                  <Pressable
                    key={model}
                    onPress={() => selectThermomixModel(model)}
                    className={cn(
                      'px-lg py-md rounded-lg border-2',
                      thermomixModel === model
                        ? 'bg-primary-medium border-primary-medium'
                        : 'bg-background-secondary border-transparent'
                    )}
                  >
                    <Text className={cn(
                      'font-semibold',
                      thermomixModel === model ? 'text-white' : 'text-text-primary'
                    )}>
                      {model}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* SECTION 2: OTHER EQUIPMENT */}
        <View>
          <Text preset="subheading" className="mb-md">
            {i18n.t('onboarding.equipment.other.title')}
          </Text>
          <View className="gap-md">
            {otherEquipment.map(type => {
              const config = EQUIPMENT_CONFIG[type];
              const isSelected = selectedEquipment.some(e => e.type === type);

              return (
                <Pressable
                  key={type}
                  onPress={() => toggleEquipment(type)}
                  className={cn(
                    'flex-row items-center p-md rounded-lg',
                    isSelected
                      ? 'bg-primary-lightest'
                      : 'bg-background-secondary'
                  )}
                >
                  <Text className="text-2xl mr-md">{config.icon}</Text>
                  <Text className="flex-1">
                    {i18n.t(`onboarding.equipment.${type}.name`)}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color="#FFBFB7" />
                  )}
                </Pressable>
              );
            })}
          </View>
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
