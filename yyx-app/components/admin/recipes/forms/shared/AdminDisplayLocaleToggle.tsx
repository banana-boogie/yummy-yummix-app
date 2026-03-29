import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/common/Text';
import { Ionicons } from '@expo/vector-icons';
import { useAdminLocales } from '@/hooks/admin/useAdminLocales';
import i18n from '@/i18n';

interface AdminDisplayLocaleToggleProps {
  value: string;
  onChange: (locale: string) => void;
}

export function AdminDisplayLocaleToggle({ value, onChange }: AdminDisplayLocaleToggleProps) {
  const { locales: adminLocales } = useAdminLocales();
  const locales = [...adminLocales].sort((a, b) => {
    if (a.code === 'en') return -1;
    if (b.code === 'en') return 1;
    return a.code.localeCompare(b.code);
  });

  return (
    <View className="flex-row items-center gap-sm p-sm bg-primary-lightest rounded-lg border border-primary-light">
      <Ionicons name="eye-outline" size={18} className="text-text-secondary" />
      <Text preset="bodySmall" className="text-text-secondary">
        {i18n.t('admin.common.displayLanguage', { defaultValue: 'Display' })}
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
                className={isSelected ? 'font-semibold' : 'font-normal'}
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
