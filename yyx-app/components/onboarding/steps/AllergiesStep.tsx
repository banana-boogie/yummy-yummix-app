import React, { useState, useRef, useEffect } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, StyleProp, ViewStyle, ActivityIndicator } from 'react-native';
import { Text } from '@/components/common/Text';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { DietaryRestriction, PreferenceOption } from '@/types/dietary';
import { getDietaryRestrictionIcon, DIETARY_RESTRICTION_ICONS } from '@/constants/dietaryIcons';
import i18n from '@/i18n';
import { SelectableCard } from '@/components/common/SelectableCard';
import { StepNavigationButtons } from '@/components/onboarding/StepNavigationButtons';
import { OtherInputField } from '@/components/form/OtherInputField';
import { useLanguage } from '@/contexts/LanguageContext';
import preferencesService from '@/services/preferencesService';

interface AllergiesStepProps {
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export function AllergiesStep({ className = '', style }: AllergiesStepProps) {
  const { formData, updateFormData, goToNextStep, goToPreviousStep } = useOnboarding();
  const { language } = useLanguage();
  const scrollViewRef = useRef<ScrollView>(null);

  // State for database-driven options
  const [allergyOptions, setAllergyOptions] = useState<PreferenceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // State management
  const currentRestrictions = formData.dietaryRestrictions ?? [];
  const [otherAllergies, setOtherAllergies] = useState<string[]>(
    formData.otherAllergy?.length ? formData.otherAllergy : ['']
  );
  const [error, setError] = useState('');

  // Fetch allergy options from database
  useEffect(() => {
    async function loadOptions() {
      try {
        setLoading(true);
        setFetchError(null);
        const options = await preferencesService.getFoodAllergies(language as 'en' | 'es');
        setAllergyOptions(options);
      } catch (err) {
        console.error('Failed to load allergy options:', err);
        setFetchError('Failed to load options');
      } finally {
        setLoading(false);
      }
    }

    loadOptions();
  }, [language]);

  const handleSelect = (allergySlug: string) => {
    if (allergySlug === 'none') {
      // If selecting "none", clear other selections
      updateFormData({
        dietaryRestrictions: ['none'] as DietaryRestriction[],
        otherAllergy: []
      });
      setOtherAllergies([]);
      setError('');
      return;
    }

    // Handle toggling restrictions
    const isSelected = currentRestrictions.includes(allergySlug as DietaryRestriction);
    const newRestrictions = isSelected
      ? currentRestrictions.filter(r => r !== allergySlug)
      : [...currentRestrictions.filter(r => r !== 'none'), allergySlug as DietaryRestriction];

    // Clear other allergies when deselecting "other"
    if (isSelected && allergySlug === 'other') {
      setOtherAllergies([]);
      updateFormData({
        dietaryRestrictions: newRestrictions,
        otherAllergy: []
      });
      return;
    }

    // Initialize "other" allergies when selecting it
    if (!isSelected && allergySlug === 'other') {
      setOtherAllergies(['']);
      scrollToBottom();
    }

    updateFormData({ dietaryRestrictions: newRestrictions });
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleAddOtherAllergy = () => {
    setOtherAllergies([...otherAllergies, '']);
    scrollToBottom();
  };

  const handleOtherAllergyChange = (newAllergies: string[]) => {
    setOtherAllergies(newAllergies);
    updateFormData({ otherAllergy: newAllergies.filter(Boolean) });
    setError('');
  };

  const handleRemoveOtherAllergy = (indexToRemove: number) => {
    const newOtherAllergies = otherAllergies.filter((_, index) => index !== indexToRemove);
    setOtherAllergies(newOtherAllergies);
    updateFormData({ otherAllergy: newOtherAllergies.filter(Boolean) });
  };

  const handleNext = () => {
    if (!formData.dietaryRestrictions?.length) return;

    if (currentRestrictions.includes('other')) {
      const validAllergies = otherAllergies.filter(a => a.trim().length > 0);
      if (validAllergies.length > 0) {
        updateFormData({ otherAllergy: validAllergies });
      } else {
        setError(i18n.t('validation.otherAllergyRequired'));
        scrollToBottom();
        return;
      }
    }

    goToNextStep();
  };

  const isNextDisabled = () => {
    if (!formData.dietaryRestrictions?.length) return true;

    if (currentRestrictions.includes('other')) {
      const validAllergies = otherAllergies.filter(a => a.trim().length > 0);
      return validAllergies.length === 0;
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
    { slug: 'none', name: i18n.t('onboarding.steps.allergies.options.none'), iconName: undefined },
    ...allergyOptions,
    { slug: 'other', name: i18n.t('onboarding.steps.allergies.options.other'), iconName: undefined },
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
              {i18n.t('onboarding.steps.allergies.title')}
            </Text>

            <Text preset="subheading" align='center' className="mb-lg text-base">
              {i18n.t('onboarding.steps.allergies.subtitle')}
            </Text>
          </View>

          <View className="gap-sm">
            {displayOptions.map((option) => (
              <React.Fragment key={option.slug}>
                <SelectableCard
                  selected={currentRestrictions.includes(option.slug as DietaryRestriction)}
                  onPress={() => handleSelect(option.slug)}
                  label={option.name}
                  icon={
                    option.slug === 'none'
                      ? DIETARY_RESTRICTION_ICONS.none
                      : option.slug === 'other'
                        ? DIETARY_RESTRICTION_ICONS.other
                        : getDietaryRestrictionIcon(option.slug)
                  }
                />
                {option.slug === 'other' && currentRestrictions.includes('other') && (
                  <OtherInputField
                    items={otherAllergies}
                    onItemsChange={handleOtherAllergyChange}
                    placeholder={i18n.t('onboarding.steps.allergies.otherPlaceholder')}
                    error={error}
                    onAddItem={handleAddOtherAllergy}
                    onRemoveItem={handleRemoveOtherAllergy}
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
