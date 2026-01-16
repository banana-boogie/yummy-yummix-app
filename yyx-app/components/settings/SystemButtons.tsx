import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/common/Text';
import { MeasurementSystem } from '@/types/user';
import { ProviderType } from '@/services/voice/VoiceProviderFactory';
import { useDevice } from '@/hooks/useDevice';
import i18n from '@/i18n';

interface SystemButtonsProps {
  language: string;
  onLanguageChange: (lang: string) => void;
  measurementSystem: MeasurementSystem;
  onMeasurementChange: (system: MeasurementSystem) => void;
  voiceProvider: ProviderType;
  onVoiceProviderChange: (provider: ProviderType) => void;
}

export function SystemButtons({
  language,
  onLanguageChange,
  measurementSystem,
  onMeasurementChange,
  voiceProvider,
  onVoiceProviderChange
}: SystemButtonsProps) {
  const { isLarge: isLargeScreen } = useDevice();

  const renderButton = (
    label: string,
    isActive: boolean,
    onPress: () => void,
    description?: string
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
      {description && (
        <Text
          preset="caption"
          className={`
            text-center mt-xs
            ${isActive ? 'text-neutral-white' : 'text-text-secondary'}
          `}
        >
          {description}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View className="mb-lg px-md">
      {/* Language Selection */}
      <View className="mb-xl">
        <Text className="text-text-secondary text-base mb-sm font-medium">
          {i18n.t('profile.language')}
        </Text>
        <View className={`flex-row gap-sm ${isLargeScreen ? 'gap-md max-w-[600px]' : ''}`}>
          {renderButton('Español', language === 'es', () => onLanguageChange('es'))}
          {renderButton('English', language === 'en', () => onLanguageChange('en'))}
        </View>
      </View>

      {/* Measurement System Selection */}
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

      {/* Voice Provider Selection */}
      <View className="mb-xl">
        <Text className="text-text-secondary text-base mb-sm font-medium">
          {i18n.t('settings.voiceProvider')}
        </Text>
        <View className={`flex-row gap-sm ${isLargeScreen ? 'gap-md max-w-[600px]' : ''}`}>
          {renderButton(
            'Gemini',
            voiceProvider === 'gemini-live',
            () => onVoiceProviderChange('gemini-live'),
            'Google AI - Fast'
          )}
          {renderButton(
            'OpenAI',
            voiceProvider === 'openai-realtime',
            () => onVoiceProviderChange('openai-realtime'),
            'Premium - Best'
          )}
          {renderButton(
            'HTS',
            voiceProvider === 'hear-think-speak',
            () => onVoiceProviderChange('hear-think-speak'),
            'Custom - Cheapest'
          )}
        </View>
      </View>
    </View>
  );
}