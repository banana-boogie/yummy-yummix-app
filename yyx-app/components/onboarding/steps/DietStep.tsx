import React, { useState, useRef, useEffect } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, StyleProp, ViewStyle, ActivityIndicator } from 'react-native';
import { Text } from '@/components/common/Text';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { DietType, PreferenceOption } from '@/types/dietary';
import i18n from '@/i18n';
import { SelectableCard } from '@/components/common/SelectableCard';
import { StepNavigationButtons } from '@/components/onboarding/StepNavigationButtons';
import { getDietTypeIcon, DIETARY_RESTRICTION_ICONS } from '@/constants/dietaryIcons';
import { OtherInputField } from '@/components/form/OtherInputField';
import { useLanguage } from '@/contexts/LanguageContext';
import preferencesService from '@/services/preferencesService';

interface DietStepProps {
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export function DietStep({
  className = '',
  style
}: DietStepProps) {
  const { formData, updateFormData, goToPreviousStep, goToNextStep } = useOnboarding();
  const { language } = useLanguage();
  const scrollViewRef = useRef<ScrollView>(null);

  // State for database-driven options
  const [dietOptions, setDietOptions] = useState<PreferenceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // State management
  const currentDietTypes = formData.dietTypes ?? [];
  const [otherDiets, setOtherDiets] = useState<string[]>(
    formData.otherDiet?.length ? formData.otherDiet : ['']
  );
  const [error, setError] = useState('');

  // Fetch diet options from database
  useEffect(() => {
    async function loadOptions() {
      try {
        setLoading(true);
        setFetchError(null);
        const options = await preferencesService.getDietTypes(language as 'en' | 'es');
        setDietOptions(options);
      } catch (err) {
        console.error('Failed to load diet options:', err);
        setFetchError('Failed to load options');
      } finally {
        setLoading(false);
      }
    }

    loadOptions();
  }, [language]);

  const handleSelect = (dietSlug: string) => {
    if (dietSlug === 'none') {
      // If selecting "none", clear other selections
      updateFormData({
        dietTypes: ['none'] as DietType[],
        otherDiet: []
      });
      setOtherDiets([]);
      setError('');
      return;
    }

    // Handle toggling diet types
    const isSelected = currentDietTypes.includes(dietSlug as DietType);
    const newDietTypes = isSelected
      ? currentDietTypes.filter(d => d !== dietSlug)
      : [...currentDietTypes.filter(d => d !== 'none'), dietSlug as DietType];

    // Clear other diets when deselecting "other"
    if (isSelected && dietSlug === 'other') {
      setOtherDiets([]);
      updateFormData({
        dietTypes: newDietTypes,
        otherDiet: []
      });
      return;
    }

    // Initialize "other" diets when selecting it
    if (!isSelected && dietSlug === 'other') {
      setOtherDiets(['']);
      scrollToBottom();
    }

    updateFormData({ dietTypes: newDietTypes });
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleAddOtherDiet = () => {
    setOtherDiets([...otherDiets, '']);
    scrollToBottom();
  };

  const handleOtherDietChange = (newDiets: string[]) => {
    setOtherDiets(newDiets);
    updateFormData({ otherDiet: newDiets.filter(Boolean) });
    setError('');
  };

  const handleRemoveOtherDiet = (indexToRemove: number) => {
    const newOtherDiets = otherDiets.filter((_, index) => index !== indexToRemove);
    setOtherDiets(newOtherDiets);
    updateFormData({ otherDiet: newOtherDiets.filter(Boolean) });
  };

  const handleNext = () => {
    if (!formData.dietTypes?.length) return;

    if (currentDietTypes.includes('other')) {
      const validDiets = otherDiets.filter(d => d.trim().length > 0);

      if (validDiets.length > 0) {
        updateFormData({ otherDiet: validDiets });
      } else {
        setError(i18n.t('validation.otherDietRequired'));
        scrollToBottom();
        return;
      }
    }

    goToNextStep();
  };

  const isNextDisabled = () => {
    if (!formData.dietTypes?.length) return true;

    if (currentDietTypes.includes('other')) {
      const validDiets = otherDiets.filter(d => d.trim().length > 0);
      return validDiets.length === 0;
    }

    return false;
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
  if (fetchError) {
    return (
      <View className={`flex-1 px-md pt-sm justify-center items-center ${className}`} style={style}>
        <Text preset="body" className="text-center text-status-error mb-md">
          {fetchError}
        </Text>
        <StepNavigationButtons
          onNext={goToNextStep}
          onBack={goToPreviousStep}
          disabled={false}
        />
      </View>
    );
  }

  // Build the list of options: "none" + database options + "other"
  const displayOptions = [
    { slug: 'none', name: i18n.t('onboarding.steps.diet.options.none'), iconName: undefined },
    ...dietOptions,
    { slug: 'other', name: i18n.t('onboarding.steps.diet.options.other'), iconName: undefined },
  ];

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
            {displayOptions.map((option) => (
              <React.Fragment key={option.slug}>
                <SelectableCard
                  selected={currentDietTypes.includes(option.slug as DietType)}
                  onPress={() => handleSelect(option.slug)}
                  label={option.name}
                  className="mb-xs"
                  icon={
                    option.slug === 'none'
                      ? DIETARY_RESTRICTION_ICONS.none
                      : option.slug === 'other'
                        ? DIETARY_RESTRICTION_ICONS.other
                        : getDietTypeIcon(option.slug)
                  }
                />
                {option.slug === 'other' && currentDietTypes.includes('other') && (
                  <OtherInputField
                    items={otherDiets}
                    onItemsChange={handleOtherDietChange}
                    placeholder={i18n.t('onboarding.steps.diet.otherPlaceholder')}
                    error={error}
                    onAddItem={handleAddOtherDiet}
                    onRemoveItem={handleRemoveOtherDiet}
                    addButtonLabel={i18n.t('onboarding.common.addAnother')}
                  />
                )}
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
