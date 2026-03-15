import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/common/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { ContentHealthSummary, IssueFilter } from '@/services/admin/adminContentHealthService';
import i18n from '@/i18n';

interface HealthSummaryCardsProps {
  summary: ContentHealthSummary;
  activeFilter: IssueFilter;
  onFilterSelect: (filter: IssueFilter) => void;
}

interface CardConfig {
  filter: IssueFilter;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  titleKey: string;
  total: number;
  breakdown: string;
}

export function HealthSummaryCards({ summary, activeFilter, onFilterSelect }: HealthSummaryCardsProps) {
  const t = (key: string) => i18n.t(`admin.contentHealth.${key}`);

  const cards: CardConfig[] = [
    {
      filter: 'translation',
      icon: 'language-outline',
      color: COLORS.status.warning,
      titleKey: 'missingTranslations',
      total: summary.missingTranslations.total,
      breakdown: `${summary.missingTranslations.recipes} ${t('recipes')}, ${summary.missingTranslations.ingredients} ${t('ingredients')}, ${summary.missingTranslations.usefulItems} ${t('kitchenTools')}`,
    },
    {
      filter: 'image',
      icon: 'image-outline',
      color: COLORS.status.error,
      titleKey: 'missingImages',
      total: summary.missingImages.total,
      breakdown: `${summary.missingImages.recipes} ${t('recipes')}, ${summary.missingImages.ingredients} ${t('ingredients')}, ${summary.missingImages.usefulItems} ${t('kitchenTools')}`,
    },
    {
      filter: 'nutrition',
      icon: 'nutrition-outline',
      color: COLORS.primary.darkest,
      titleKey: 'missingNutrition',
      total: summary.missingNutrition.total,
      breakdown: `${summary.missingNutrition.ingredients} ${t('ingredients')}`,
    },
    {
      filter: 'unpublished',
      icon: 'eye-off-outline',
      color: COLORS.text.secondary,
      titleKey: 'unpublished',
      total: summary.unpublished.total,
      breakdown: `${summary.unpublished.recipes} ${t('recipes')}`,
    },
  ];

  return (
    <View className="flex-row flex-wrap mb-md">
      {cards.map((card) => {
        const isActive = activeFilter === card.filter;
        return (
          <TouchableOpacity
            key={card.filter}
            className={`w-1/2 p-xs`}
            onPress={() => onFilterSelect(isActive ? 'all' : card.filter)}
            activeOpacity={0.7}
          >
            <View
              className={`p-md rounded-lg ${isActive ? 'border-2' : 'border border-border-default'}`}
              style={[
                { backgroundColor: COLORS.neutral.white },
                isActive && { borderColor: card.color },
              ]}
            >
              <View className="flex-row items-center mb-xs">
                <Ionicons name={card.icon} size={20} color={card.color} />
                <Text preset="h3" className="ml-xs" style={{ color: card.color }}>
                  {card.total}
                </Text>
              </View>
              <Text preset="bodySmall" className="text-text-default font-semibold mb-xxs">
                {t(card.titleKey)}
              </Text>
              <Text preset="caption" className="text-text-secondary">
                {card.breakdown}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
