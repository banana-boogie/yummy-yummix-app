import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from '@/components/common/Text';
import { Ionicons } from '@expo/vector-icons';
import { useActiveLocales, ActiveLocale } from '@/hooks/admin/useActiveLocales';
import i18n from '@/i18n';

const STORAGE_KEY = 'admin_authoring_locale';
const DEFAULT_LOCALE = 'es';

interface AuthoringLanguagePickerProps {
  value: string;
  onChange: (locale: string) => void;
}

export function AuthoringLanguagePicker({ value, onChange }: AuthoringLanguagePickerProps) {
  const { locales } = useActiveLocales();

  return (
    <View className="flex-row items-center gap-sm mb-md p-sm bg-primary-lightest rounded-lg border border-primary-light">
      <Ionicons name="language-outline" size={18} className="text-text-secondary" />
      <Text preset="bodySmall" className="text-text-secondary">
        {i18n.t('admin.translate.authoringLanguage')}
      </Text>
      <View className="flex-row gap-xs ml-auto">
        {locales.map(locale => {
          const isSelected = value === locale.code;
          return (
            <TouchableOpacity
              key={locale.code}
              onPress={() => onChange(locale.code)}
              className={`px-md py-xs rounded-round ${
                isSelected
                  ? 'bg-primary-medium'
                  : 'bg-background-default border border-border-default'
              }`}
            >
              <Text
                preset="bodySmall"
                fontWeight={isSelected ? '600' : '400'}
              >
                {locale.displayName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/** Load the persisted authoring locale from storage */
export async function loadAuthoringLocale(): Promise<string> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_LOCALE;
    }
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return stored || DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** Save the authoring locale to storage */
export async function saveAuthoringLocale(locale: string): Promise<void> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, locale);
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Silently fail
  }
}
