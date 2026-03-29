import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/common/Text';
import { useAdminLocales } from '@/hooks/admin/useAdminLocales';

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
    <View className="flex-row items-center gap-xs">
      {locales.map(locale => {
        const isSelected = value === locale.code;
        return (
          <TouchableOpacity
            key={locale.code}
            onPress={() => onChange(locale.code)}
            className={`px-sm py-xxs rounded-full ${isSelected ? 'bg-primary-default' : ''}`}
          >
            <Text
              preset="caption"
              className={isSelected ? 'text-text-default font-semibold' : 'text-text-secondary'}
            >
              {locale.displayName}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
