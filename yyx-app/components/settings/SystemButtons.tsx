import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/common/Text';
import { MeasurementSystem } from '@/types/user';
import { useDevice } from '@/hooks/useDevice';
import i18n from '@/i18n';

interface SystemButtonsProps {
  language: string;
  onLanguageChange: (lang: string) => void;
  measurementSystem: MeasurementSystem;
  onMeasurementChange: (system: MeasurementSystem) => void;
}

export function SystemButtons({
  language,
  onLanguageChange,
  measurementSystem,
  onMeasurementChange
}: SystemButtonsProps) {
  const { isLarge: isLargeScreen } = useDevice();

  const renderButton = (
    label: string,
    isActive: boolean,
    onPress: () => void
  ) => (
    <TouchableOpacity
      className={`
        flex-1 items-center justify-center rounded-md py-sm px-md
        ${isActive ? 'bg-primary-medium' : 'bg-background-secondary'}
        ${isLargeScreen ? 'py-md px-lg' : ''}
      `}
      onPress={onPress}
    >
      <Text
        className={`
          text-center text-base
          ${isActive ? 'text-neutral-white font-semibold' : 'text-text-default'}
          ${isLargeScreen ? 'text-md' : ''}
        `}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View className="mb-lg px-md">
      <View className="mb-xl">
        <Text className="text-text-secondary text-base mb-sm font-medium">
          {i18n.t('profile.language')}
        </Text>
        <View className={`flex-row gap-sm ${isLargeScreen ? 'gap-md max-w-[600px]' : ''}`}>
          {renderButton('Español', language === 'es', () => onLanguageChange('es'))}
          {renderButton('English', language === 'en', () => onLanguageChange('en'))}
        </View>
      </View>

      <View className="mb-xl">
        <Text className="text-text-secondary text-base mb-sm font-medium">
          {i18n.t('profile.measurementSystem')}
        </Text>
        <View className={`flex-row gap-sm ${isLargeScreen ? 'gap-md max-w-[600px]' : ''}`}>
          {renderButton(
            i18n.t('settings.metric'),
            measurementSystem === MeasurementSystem.METRIC,
            () => onMeasurementChange(MeasurementSystem.METRIC)
          )}
          {renderButton(
            i18n.t('settings.imperial'),
            measurementSystem === MeasurementSystem.IMPERIAL,
            () => onMeasurementChange(MeasurementSystem.IMPERIAL)
          )}
        </View>
      </View>
    </View>
  );
}