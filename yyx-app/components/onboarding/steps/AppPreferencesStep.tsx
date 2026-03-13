import React, { useEffect } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { Text } from '@/components/common/Text';
import { getLocales } from 'expo-localization';
import { StepNavigationButtons } from '../StepNavigationButtons';
import { Language } from '@/types/Language';
import { MeasurementSystem } from '@/types/user';
import i18n from '@/i18n';
import { Button } from '@/components/common/Button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useActiveLocales } from '@/hooks/admin/useActiveLocales';

const LANGUAGE_OPTIONS = [
  { value: 'es' as Language, label: 'Español' },
  { value: 'en' as Language, label: 'English' },
] as const;

const MEASUREMENT_OPTIONS = [
  {
    value: 'metric' as MeasurementSystem,
    label: i18n.t('onboarding.steps.appPreferences.measurements.metric.title'),
    example: i18n.t('onboarding.steps.appPreferences.measurements.metric.examples')
  },
  {
    value: 'imperial' as MeasurementSystem,
    label: i18n.t('onboarding.steps.appPreferences.measurements.imperial.title'),
    example: i18n.t('onboarding.steps.appPreferences.measurements.imperial.examples')
  },
] as const;

interface AppPreferencesStepProps {
  className?: string; // Add className
  style?: StyleProp<ViewStyle>;
}

export function AppPreferencesStep({ className = '', style }: AppPreferencesStepProps) {
  const { formData, updateFormData, goToNextStep, goToPreviousStep } = useOnboarding();
  const { setLocale, language } = useLanguage();
  const { locales: activeLocales } = useActiveLocales(true);
  const deviceLocales = getLocales();

  // Set defaults once active locales are loaded.
  // We wait for activeLocales to be non-empty so the device-locale lookup
  // actually has data to match against. Without this guard the first render
  // seeds a base code (es/en) and the `if (!formData.locale)` check prevents
  // upgrading to the correct regional locale when the fetch completes.
  useEffect(() => {
    if (activeLocales.length === 0) return;

    const isSpanish = language === 'es';
    const knownCodes = activeLocales.map((l) => l.code);
    const deviceTag = deviceLocales[0]?.languageTag;
    const bestLocale =
      deviceTag && knownCodes.includes(deviceTag) ? deviceTag : (isSpanish ? 'es' : 'en');
    const defaultMeasurement = isSpanish ? 'metric' : 'imperial';

    // Always re-derive locale from device when activeLocales load —
    // a stale base-code seed from a previous render should be upgraded.
    if (!formData.locale || formData.locale === 'es' || formData.locale === 'en') {
      updateFormData({
        locale: bestLocale,
        measurementSystem: formData.measurementSystem || defaultMeasurement,
      });
    }
  }, [activeLocales]);

  const handleLanguageSelect = async (language: Language) => {
    // Use device locale if it matches the selected language and exists
    // in the locales table; otherwise fall back to the base code.
    const matchingDevice = deviceLocales.find(
      (dl) => dl.languageCode === language
    );
    const deviceTag = matchingDevice?.languageTag;
    const knownCodes = activeLocales.map((l) => l.code);
    const locale =
      deviceTag && knownCodes.includes(deviceTag) ? deviceTag : language;

    await setLocale(locale);
    i18n.locale = language;
    updateFormData({ locale });
  };

  const handleMeasurementSelect = (measurementSystem: MeasurementSystem) => {
    updateFormData({ measurementSystem });
  };

  return (
    <View className={`flex-1 px-lg pt-xxl ${className}`} style={style}>
      <View className="flex-1 items-center">
        <Text preset="h1" className="mb-sm">
          {i18n.t('onboarding.steps.appPreferences.title')}
        </Text>

        <Text preset="body" className="mb-xxl" align='center'>
          {i18n.t('onboarding.steps.appPreferences.subtitle')}
        </Text>

        <View className="mb-xxxl items-center w-full">
          <Text preset="body" align='center' marginBottom={16} fontWeight="semibold">
            {i18n.t('onboarding.steps.appPreferences.language')}
          </Text>
          <View className="flex-row gap-lg justify-center w-full">
            {LANGUAGE_OPTIONS.map(option => (
              <Button
                key={option.value}
                variant={(formData.locale?.startsWith(option.value) || (option.value === 'en' && !formData.locale?.startsWith('es'))) ? 'primary' : 'secondary'}
                size="medium"
                label={option.label}
                onPress={() => handleLanguageSelect(option.value)}
                className="flex-1 rounded-lg max-w-[200px]"
              />
            ))}
          </View>
        </View>

        <View className="mb-xxxl items-center w-full">
          <Text preset="body" marginBottom={16} fontWeight="semibold">
            {i18n.t('onboarding.steps.appPreferences.measurementSystem')}
          </Text>
          <View className="flex-row gap-lg justify-center w-full">
            {MEASUREMENT_OPTIONS.map(option => (
              <Button
                key={option.value}
                variant={formData.measurementSystem === option.value ? 'primary' : 'secondary'}
                size="small"
                onPress={() => handleMeasurementSelect(option.value)}
                className="flex-1 rounded-lg max-w-[200px]"
              >
                <View>
                  <Text className="mb-xxxs text-center">
                    {option.label}
                  </Text>
                  <Text className="text-xs">
                    {option.example}
                  </Text>
                </View>
              </Button>
            ))}
          </View>
        </View>
      </View>

      <StepNavigationButtons
        onBack={goToPreviousStep}
        onNext={goToNextStep}
      />
    </View>
  );
}
