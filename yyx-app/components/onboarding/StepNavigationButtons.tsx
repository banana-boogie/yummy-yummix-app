import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { Button } from '@/components/common/Button';
import i18n from '@/i18n';

interface StepButtonsProps {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  isLastStep?: boolean;
  disabled?: boolean;
  loading?: boolean;
  className?: string; // Add className
  buttonClassName?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function StepNavigationButtons({
  onBack,
  onNext,
  nextLabel,
  isLastStep,
  disabled,
  loading,
  className = '',
  buttonClassName = '',
  containerStyle,
}: StepButtonsProps) {

  return (
    <View className={`bg-background-default pb-[500px] mb-[-500px] ${className}`}>
      <View
        className={`flex-row ${onBack ? 'justify-between' : 'justify-center'} mt-lg mb-xxl pt-lg gap-lg border-t border-border-default bg-background-default`}
        style={containerStyle}
      >
        {onBack ? (
          <>
            <Button
              onPress={onBack}
              variant="secondary"
              size="medium"
              label={i18n.t('onboarding.common.back')}
              disabled={loading}
              className={`flex-1 max-w-[360px] md:max-w-[460px] lg:max-w-[560px] py-[16px] ${buttonClassName}`}
            />
            <Button
              onPress={onNext}
              disabled={disabled}
              size="medium"
              loading={loading}
              fontWeight="bold"
              label={nextLabel || i18n.t(isLastStep ? 'onboarding.common.finish' : 'onboarding.common.next')}
              className={`flex-1 max-w-[360px] md:max-w-[460px] lg:max-w-[560px] py-[16px] ${buttonClassName}`}
            />
          </>
        ) : (
          <View className="items-center w-full">
            <Button
              onPress={onNext}
              disabled={disabled}
              size="large"
              fontWeight="bold"
              loading={loading}
              label={nextLabel || i18n.t(isLastStep ? 'onboarding.common.finish' : 'onboarding.common.next')}
              className={`w-full max-w-[400px] md:max-w-[500px] lg:max-w-[600px] py-[20px] ${buttonClassName}`}
            />
          </View>
        )}
      </View>
    </View>
  );
}