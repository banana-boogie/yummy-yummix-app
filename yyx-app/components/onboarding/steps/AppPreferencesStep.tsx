import React, { useEffect, useState } from 'react';
import { View, StyleProp, ViewStyle, ActivityIndicator } from 'react-native';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { Text } from '@/components/common/Text';
import * as Localization from 'expo-localization';
import { StepNavigationButtons } from '../StepNavigationButtons';
import { Language } from '@/types/Language';
import { MeasurementSystem } from '@/types/user';
import i18n from '@/i18n';
import { Button } from '@/components/common/Button';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';

interface LocaleOption {
  code: string;
  displayName: string;
}

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

// Fallback locale options if the locales table fetch fails
const FALLBACK_LOCALE_OPTIONS: LocaleOption[] = [
  { code: 'es', displayName: 'Espanol' },
  { code: 'en', displayName: 'English' },
];

interface AppPreferencesStepProps {
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export function AppPreferencesStep({ className = '', style }: AppPreferencesStepProps) {
  const { formData, updateFormData, goToNextStep, goToPreviousStep } = useOnboarding();
  const { setLocale } = useLanguage();
  const systemLocale = Localization.getLocales()[0].languageCode;

  const [localeOptions, setLocaleOptions] = useState<LocaleOption[]>(FALLBACK_LOCALE_OPTIONS);
  const [loadingLocales, setLoadingLocales] = useState(true);

  // Fetch available locales from the database
  useEffect(() => {
    async function fetchLocales() {
      try {
        const { data, error } = await supabase
          .from('locales')
          .select('code, display_name')
          .eq('is_active', true)
          .is('parent_code', null) // Only top-level locales for the picker
          .order('display_name', { ascending: true });

        if (!error && data && data.length > 0) {
          setLocaleOptions(data.map((l: any) => ({
            code: l.code,
            displayName: l.display_name,
          })));
        }
      } catch {
        // Use fallback options silently
      } finally {
        setLoadingLocales(false);
      }
    }
    fetchLocales();
  }, []);

  // Set defaults when component mounts
  useEffect(() => {
    const defaultLanguage = systemLocale === 'es' ? 'es' : 'en';
    const defaultMeasurement = defaultLanguage === 'en' ? 'imperial' : 'metric';

    if (!formData.language) {
      updateFormData({
        language: defaultLanguage,
        measurementSystem: defaultMeasurement
      });
    }
  }, [systemLocale, formData.language, updateFormData]);

  const handleLocaleSelect = async (localeCode: string) => {
    const lang = localeCode.startsWith('es') ? 'es' : 'en' as Language;
    await setLocale(localeCode);
    i18n.locale = lang;
    updateFormData({ language: lang });
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
          {loadingLocales ? (
            <ActivityIndicator size="small" />
          ) : (
            <View className="flex-row gap-lg justify-center w-full flex-wrap">
              {localeOptions.map(option => (
                <Button
                  key={option.code}
                  variant={formData.language === (option.code.startsWith('es') ? 'es' : 'en') ? 'primary' : 'secondary'}
                  size="medium"
                  label={option.displayName}
                  onPress={() => handleLocaleSelect(option.code)}
                  className="flex-1 rounded-lg max-w-[200px]"
                />
              ))}
            </View>
          )}
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
