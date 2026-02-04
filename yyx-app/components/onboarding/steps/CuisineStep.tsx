import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { CuisinePreference } from '@/types/dietary';
import { getCuisineIcon } from '@/constants/dietaryIcons';
import i18n from '@/i18n';
import { SelectableCard } from '@/components/common/SelectableCard';
import { StepNavigationButtons } from '@/components/onboarding/StepNavigationButtons';
import { useLanguage } from '@/contexts/LanguageContext';
import preferencesService from '@/services/preferencesService';
import { PreferenceOption } from '@/types/dietary';
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
  const { language } = useLanguage();
  const scrollViewRef = useRef<ScrollView>(null);

  // State for database-driven options
  const [cuisineOptions, setCuisineOptions] = useState<PreferenceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Current selections
  const currentCuisines = formData.cuisinePreferences ?? [];

  // Fetch cuisine options from database
  useEffect(() => {
    async function loadOptions() {
      try {
        setLoading(true);
        setError(null);
        const options = await preferencesService.getCuisinePreferences(language as 'en' | 'es');
        setCuisineOptions(options);
      } catch (err) {
        console.error('Failed to load cuisine options:', err);
        setError(i18n.t('common.errors.loadOptions'));
      } finally {
        setLoading(false);
      }
    }

    loadOptions();
  }, [language]);

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

  // Show loading state
  if (loading) {
    return (
      <View className={`flex-1 px-md pt-sm justify-center items-center ${className}`} style={style}>
        <ActivityIndicator size="large" color="#FFBFB7" />
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View className={`flex-1 px-md pt-sm justify-center items-center ${className}`} style={style}>
        <Text preset="body" className="text-center text-status-error mb-md">
          {error}
        </Text>
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
            {cuisineOptions.map((cuisine) => (
              <SelectableCard
                key={cuisine.slug}
                selected={currentCuisines.includes(cuisine.slug as CuisinePreference)}
                onPress={() => handleSelect(cuisine.slug as CuisinePreference)}
                label={cuisine.name}
                icon={getCuisineIcon(cuisine.slug)}
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
