import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ArrowButton } from '@/components/navigation/ArrowButton';
import { Button } from '@/components/common/Button';
import { useDevice } from '@/hooks/useDevice';

interface StepNavigationButtonsProps {
  onBack: () => void;
  onNext: () => void;
  backText: string;
  nextText: string;
  isLastStep?: boolean;
  finishText?: string;
  className?: string; // Add className
  style?: StyleProp<ViewStyle>;
}

export function StepNavigationButtons({
  onBack,
  onNext,
  backText,
  nextText,
  isLastStep,
  finishText = 'Finish',
  className = '',
  style,
}: StepNavigationButtonsProps) {
  const { isLarge } = useDevice();

  // Determine button size based on screen size
  const buttonSize = isLarge ? 'large' : 'medium';

  const handleBack = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onBack();
  };

  const handleNext = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onNext();
  };

  return (
    <View className={`py-md w-full ${className}`} style={style}>
      <View className={`flex-row justify-around w-full lg:justify-center lg:gap-xl`}>
        <ArrowButton
          onPress={handleBack}
          direction="back"
          variant="secondary"
          textKey={backText}
          size={buttonSize}
        />
        {isLastStep ? (
          <Button
            onPress={handleNext}
            label={finishText}
            variant="primary"
            className="min-w-[140px] lg:min-w-[180px]"
            textStyle={{
              fontWeight: '600',
              fontSize: 24,
            }}
            size={buttonSize}
          />
        ) : (
          <ArrowButton
            onPress={handleNext}
            variant="primary"
            textKey={nextText}
            size={buttonSize}
          />
        )}
      </View>
    </View>
  );
}
