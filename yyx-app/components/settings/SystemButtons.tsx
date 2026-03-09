import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from '@/components/common/Text';
import { MeasurementSystem } from '@/types/user';
import { useDevice } from '@/hooks/useDevice';
import i18n from '@/i18n';
import { supabase } from '@/lib/supabase';

interface LocaleOption {
  code: string;
  displayName: string;
}

const FALLBACK_LOCALE_OPTIONS: LocaleOption[] = [
  { code: 'en', displayName: 'English' },
  { code: 'es', displayName: 'Espanol' },
];

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
          .not('code', 'like', '%-%') // Base languages only (en, es), not regional variants (es-MX)
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

  const renderButton = (
    label: string,
    isActive: boolean,
    onPress: () => void,
    sublabel?: string
  ) => (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-1 items-center justify-center py-md px-sm rounded-lg border-2 ${isActive
          ? 'bg-primary-medium border-primary-darkest'
          : 'bg-white border-grey-medium'
        }`}
    >
      <Text
        className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-text-default'
          }`}
      >
        {label}
      </Text>
      {sublabel && (
        <Text
          className={`text-xs mt-xs ${isActive ? 'text-white/70' : 'text-text-secondary'
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
        {loadingLocales ? (
          <ActivityIndicator size="small" />
        ) : (
          <View className={`flex-row gap-sm flex-wrap ${isLargeScreen ? 'gap-md max-w-[600px]' : ''}`}>
            {localeOptions.map(option => {
              const isActive = language === option.code ||
                (language.startsWith('es') && option.code.startsWith('es')) ||
                (language.startsWith('en') && option.code.startsWith('en'));
              return (
                <React.Fragment key={option.code}>
                  {renderButton(
                    option.displayName,
                    isActive,
                    () => onLanguageChange(option.code),
                    undefined
                  )}
                </React.Fragment>
              );
            })}
          </View>
        )}
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
