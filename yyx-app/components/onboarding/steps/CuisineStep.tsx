import React, { useRef } from 'react';
import { View, ScrollView, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { CuisinePreference, CUISINE_PREFERENCES } from '@/types/dietary';
import { getCuisineIcon } from '@/constants/dietaryIcons';
import i18n from '@/i18n';
import { SelectableCard } from '@/components/common/SelectableCard';
import { StepNavigationButtons } from '@/components/onboarding/StepNavigationButtons';
import { Button } from '@/components/common';
import { OnboardingData } from '@/types/onboarding';

interface CuisineStepProps {
  onComplete: (data: OnboardingData) => Promise<void>;
  isSubmitting: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export function CuisineStep({
  onComplete,
  isSubmitting,
  className = '',
  style
}: CuisineStepProps) {
  const { formData, updateFormData, goToPreviousStep } = useOnboarding();
  const scrollViewRef = useRef<ScrollView>(null);

  // Current selections
  const currentCuisines = formData.cuisinePreferences ?? [];

  const handleSelect = (cuisineSlug: CuisinePreference) => {
    const isSelected = currentCuisines.includes(cuisineSlug);
    const newCuisines = isSelected
      ? currentCuisines.filter(c => c !== cuisineSlug)
      : [...currentCuisines, cuisineSlug];

    updateFormData({ cuisinePreferences: newCuisines });
  };

  const handleSkip = () => {
    // Clear any selections and complete onboarding
    updateFormData({ cuisinePreferences: [] });
    onComplete({ ...formData, cuisinePreferences: [] } as OnboardingData);
  };

  const handleComplete = () => {
    onComplete(formData as OnboardingData);
  };

  return (
    <View className={`flex-1 px-md pt-sm ${className}`} style={style}>
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
              {i18n.t('onboarding.steps.cuisines.title')}
            </Text>

            <Text preset="subheading" align="center" className="mb-lg text-base">
              {i18n.t('onboarding.steps.cuisines.subtitle')}
            </Text>
          </View>

          <View className="gap-sm">
            {CUISINE_PREFERENCES.map((cuisine) => (
              <SelectableCard
                key={cuisine}
                selected={currentCuisines.includes(cuisine)}
                onPress={() => handleSelect(cuisine)}
                label={i18n.t(`onboarding.steps.cuisines.options.${cuisine}`)}
                icon={getCuisineIcon(cuisine)}
              />
            ))}
          </View>

          {/* Skip button */}
          <View className="mt-lg">
            <Button
              variant="flat"
              onPress={handleSkip}
              className="self-center"
            >
              {i18n.t('onboarding.steps.cuisines.skip')}
            </Button>
          </View>
        </ScrollView>
      </View>

      <StepNavigationButtons
        onNext={handleComplete}
        onBack={goToPreviousStep}
        loading={isSubmitting}
        disabled={false}
        isLastStep={true}
      />
    </View>
  );
}
