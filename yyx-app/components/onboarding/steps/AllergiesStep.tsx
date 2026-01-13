import React, { useState, useRef } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { DietaryRestriction, DIETARY_RESTRICTIONS } from '@/types/dietary';
import { getDietaryRestrictionIcon } from '@/constants/dietaryIcons';
import i18n from '@/i18n';
import { SelectableCard } from '@/components/common/SelectableCard';
import { StepNavigationButtons } from '@/components/onboarding/StepNavigationButtons';
import { OtherInputField } from '@/components/form/OtherInputField';

interface AllergiesStepProps {
  className?: string; // Add className
  style?: StyleProp<ViewStyle>;
}

export function AllergiesStep({ className = '', style }: AllergiesStepProps) {
  const { formData, updateFormData, goToNextStep, goToPreviousStep } = useOnboarding();
  const scrollViewRef = useRef<ScrollView>(null);

  // State management
  const currentRestrictions = formData.dietaryRestrictions ?? [];
  const [otherAllergies, setOtherAllergies] = useState<string[]>(
    formData.otherAllergy?.length ? formData.otherAllergy : ['']
  );
  const [error, setError] = useState('');

  const handleSelect = (restriction: DietaryRestriction) => {
    if (restriction === 'none') {
      // If selecting "none", clear other selections
      updateFormData({
        dietaryRestrictions: ['none'],
        otherAllergy: []
      });
      setOtherAllergies([]);
      setError('');
      return;
    }

    // Handle toggling restrictions
    const isSelected = currentRestrictions.includes(restriction);
    const newRestrictions = isSelected
      ? currentRestrictions.filter(r => r !== restriction)
      : [...currentRestrictions.filter(r => r !== 'none'), restriction];

    // Clear other allergies when deselecting "other"
    if (isSelected && restriction === 'other') {
      setOtherAllergies([]);
      updateFormData({
        dietaryRestrictions: newRestrictions,
        otherAllergy: []
      });
      return;
    }

    // Initialize "other" allergies when selecting it
    if (!isSelected && restriction === 'other') {
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
            {DIETARY_RESTRICTIONS.map((restriction) => (
              <React.Fragment key={restriction}>
                <SelectableCard
                  selected={currentRestrictions.includes(restriction)}
                  onPress={() => handleSelect(restriction)}
                  label={i18n.t(`onboarding.steps.allergies.options.${restriction}`)}
                  icon={getDietaryRestrictionIcon(restriction)}
                />
                {restriction === 'other' && currentRestrictions.includes('other') && (
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