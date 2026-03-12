import React from 'react';
import { ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '@/components/common/Text';
import { COLORS } from '@/constants/design-tokens';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/i18n';

export type TabType = 'overview' | 'content' | 'ai' | 'operations';

const TABS: { value: TabType; labelKey: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'overview', labelKey: 'admin.analytics.tabs.overview', icon: 'stats-chart' },
  { value: 'content', labelKey: 'admin.analytics.tabs.content', icon: 'restaurant' },
  { value: 'ai', labelKey: 'admin.analytics.tabs.ai', icon: 'sparkles' },
  { value: 'operations', labelKey: 'admin.analytics.tabs.operations', icon: 'construct' },
];

export function TabSelector({ value, onChange }: {
  value: TabType;
  onChange: (value: TabType) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-md"
      contentContainerStyle={{ paddingHorizontal: 4 }}
    >
      {TABS.map((tab) => (
        <TouchableOpacity
          key={tab.value}
          className={`flex-row items-center px-md py-sm mr-xs rounded-lg ${value === tab.value ? 'bg-primary-default' : 'bg-white border border-border-default'
            }`}
          onPress={() => onChange(tab.value)}
        >
          <Ionicons
            name={tab.icon}
            size={16}
            color={value === tab.value ? COLORS.text.default : COLORS.text.secondary}
            style={{ marginRight: 4 }}
          />
          <Text
            preset="bodySmall"
            className={value === tab.value ? 'text-text-default font-semibold' : 'text-text-secondary'}
          >
            {i18n.t(tab.labelKey)}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
