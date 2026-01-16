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
  onMeasurementChange,
}: SystemButtonsProps) {
  const { isLarge: isLargeScreen } = useDevice();

  const renderButton = (
    label: string,
    isActive: boolean,
    onPress: () => void,
    sublabel?: string
  ) => (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-1 items-center justify-center py-md px-sm rounded-lg border ${isActive
          ? 'bg-accent border-accent'
          : 'bg-surface border-border'
        }`}
    >
      <Text
        className={`text-sm font-semibold ${isActive ? 'text-text-on-accent' : 'text-text-primary'
          }`}
      >
        {label}
      </Text>
      {sublabel && (
        <Text
          className={`text-xs mt-xs ${isActive ? 'text-text-on-accent/70' : 'text-text-tertiary'
            }`}
        >
          {sublabel}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View>
      {/* Language Selection */}
      <View className="mb-xl">
        <Text className="text-text-secondary text-base mb-sm font-medium">
          {i18n.t('settings.language')}
        </Text>
        <View className={`flex-row gap-sm ${isLargeScreen ? 'gap-md max-w-[600px]' : ''}`}>
          {renderButton(
            i18n.t('settings.english'),
            language === 'en',
            () => onLanguageChange('en')
          )}
          {renderButton(
            i18n.t('settings.spanish'),
            language === 'es',
            () => onLanguageChange('es')
          )}
        </View>
      </View>

      {/* Measurement System Selection */}
      <View className="mb-xl">
        <Text className="text-text-secondary text-base mb-sm font-medium">
          {i18n.t('settings.measurementSystem')}
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