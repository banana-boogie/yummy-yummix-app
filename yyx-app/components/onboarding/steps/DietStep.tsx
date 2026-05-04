import React, { useRef } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { DietType, SELECTABLE_DIET_TYPES } from '@/types/dietary';
import i18n from '@/i18n';
import { SelectableCard } from '@/components/common/SelectableCard';
import { StepNavigationButtons } from '@/components/onboarding/StepNavigationButtons';
import { getDietTypeIcon } from '@/constants/dietaryIcons';

interface DietStepProps {
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export function DietStep({
  className = '',
  style
}: DietStepProps) {
  const { formData, updateFormData, goToPreviousStep, goToNextStep } = useOnboarding();
  const scrollViewRef = useRef<ScrollView>(null);

  // State management
  const currentDietTypes = formData.dietTypes ?? [];

  const handleSelect = (dietSlug: string) => {
    const isSelected = currentDietTypes.includes(dietSlug as DietType);
    const newDietTypes = isSelected
      ? currentDietTypes.filter(d => d !== dietSlug)
      : [...currentDietTypes, dietSlug as DietType];

    updateFormData({ dietTypes: newDietTypes, otherDiet: [] });
  };

  const handleNext = () => {
    updateFormData({ dietTypes: currentDietTypes, otherDiet: [] });
    goToNextStep();
  };

  const isNextDisabled = () => {
    return false;
  };

  return (
    <KeyboardAvoidingView
      className={`flex-1 px-md pt-sm ${className}`}
      style={style}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={120}
    >
      <View className="flex-1 w-full lg:max-w-[600px] lg:self-center">
        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          contentContainerClassName="pb-xxxl"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
        >
          <View className="mb-md">
            <Text preset="h2" className="text-center mb-md">
              {i18n.t('onboarding.steps.diet.title')}
            </Text>

            <Text preset="subheading" align='center' className="mb-lg text-base">
              {i18n.t('onboarding.steps.diet.subtitle')}
            </Text>
          </View>

          <View className="gap-sm">
            {SELECTABLE_DIET_TYPES.map((dietType) => (
              <React.Fragment key={dietType}>
                <SelectableCard
                  selected={currentDietTypes.includes(dietType)}
                  onPress={() => handleSelect(dietType)}
                  label={i18n.t(`onboarding.steps.diet.options.${dietType}`)}
                  className="mb-xs"
                  icon={getDietTypeIcon(dietType)}
                />
              </React.Fragment>
            ))}
          </View>
        </ScrollView>
      </View>

      <StepNavigationButtons
        onNext={handleNext}
        onBack={goToPreviousStep}
        disabled={isNextDisabled()}
      />
    </KeyboardAvoidingView>
  );
}
