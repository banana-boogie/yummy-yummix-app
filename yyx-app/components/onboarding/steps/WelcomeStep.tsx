import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/common/Text';
import { useOnboarding } from '@/contexts/OnboardingContext';

import i18n from '@/i18n';
import { StepNavigationButtons } from '@/components/onboarding/StepNavigationButtons';

interface WelcomeStepProps {
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export function WelcomeStep({ className = '', style }: WelcomeStepProps) {
  const { setCurrentStep } = useOnboarding();

  const handleStart = () => {
    setCurrentStep(1);
  };

  return (
    <View className={`flex-1 px-md pt-xxxl ${className}`} style={style}>
      <View className="items-center">
        <Text preset="h1" marginBottom={24} align="center">
          {i18n.t('onboarding.steps.welcome.title')}
        </Text>

        <Text preset="subheading" align="center">
          {i18n.t('onboarding.steps.welcome.subheading')}
        </Text>
      </View>

      <Image
        source={require('@/assets/images/irmixy-avatar/irmixy-excited.png')}
        className="w-full h-[250px] md:h-[350px] lg:h-[330px] my-auto self-center"
        contentFit="contain"
        cachePolicy="memory-disk"
      />
      <StepNavigationButtons
        onNext={handleStart}
        nextLabel={i18n.t('onboarding.steps.welcome.start')}
        className="border-t-0"
      />
    </View>
  );
}