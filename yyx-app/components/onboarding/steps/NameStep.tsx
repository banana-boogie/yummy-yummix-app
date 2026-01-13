import React, { useState, useCallback } from 'react';
import { View, Keyboard, Image, KeyboardAvoidingView, Platform, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';
import { TextInput } from '@/components/form/TextInput';
import { useOnboarding } from '@/contexts/OnboardingContext';

import i18n from '@/i18n';
import { StepNavigationButtons } from '@/components/onboarding/StepNavigationButtons';
import { USER_PROFILE_MAX_LENGTH } from '@/constants/userProfile';

interface NameStepProps {
    className?: string;
    style?: StyleProp<ViewStyle>;
}

export function NameStep({ className = '', style }: NameStepProps) {
    const { formData, updateFormData, setCurrentStep, currentStep } = useOnboarding();
    const [error, setError] = useState<string>('');

    const validateName = useCallback((name: string) => {
        if (!name.trim()) {
            return i18n.t('validation.required');
        }
        if (name.trim().length < 2) {
            return i18n.t('validation.nameMinLength');
        }
        if (name.trim().length > 50) {
            return i18n.t('validation.nameMaxLength');
        }
        return '';
    }, []);

    const handleTextChange = useCallback((text: string) => {
        updateFormData({ name: text });
        setError(''); // Clear error when typing
    }, [updateFormData]);

    const handleBack = useCallback(() => {
        setCurrentStep(currentStep - 1);
    }, [setCurrentStep, currentStep]);

    const handleNext = useCallback(() => {
        Keyboard.dismiss();
        const nameError = validateName(formData.name || '');
        if (nameError) {
            setError(nameError);
            return;
        }
        setCurrentStep(currentStep + 1); // Move to next step
    }, [validateName, formData.name, setCurrentStep, currentStep]);

    return (
        <KeyboardAvoidingView
            className={`flex-1 px-lg pt-xxl ${className}`}
            style={style}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={32}
        >
            <View className="flex-1">
                <View className="pb-lg mb-auto">
                    <Text preset="h1" className="text-center" marginBottom={12}>
                        {i18n.t('onboarding.steps.name.title')}
                    </Text>

                    <Text preset="body" className="text-center">
                        {i18n.t('onboarding.steps.name.subtitle')}
                    </Text>
                </View>

                <TextInput
                    value={formData.name}
                    onChangeText={handleTextChange}
                    placeholder={i18n.t('onboarding.steps.name.placeholder')}
                    error={error}
                    onSubmitEditing={handleNext}
                    maxLength={USER_PROFILE_MAX_LENGTH}
                    showCounter={true}
                    containerClassName="max-w-[360px] self-center"
                />

                <Image
                    source={require('@/assets/images/irmixy/irmixy-hello.png')}
                    className="w-full h-[250px] lg:h-[275px] mt-auto self-center mr-lg max-w-[400px]"
                    resizeMode="contain"
                />
            </View>

            <StepNavigationButtons
                onNext={handleNext}
                onBack={handleBack}
                disabled={!formData.name?.trim()}
            />
        </KeyboardAvoidingView>
    );
}