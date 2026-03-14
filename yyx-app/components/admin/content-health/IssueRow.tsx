import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { ContentHealthIssue } from '@/services/admin/adminContentHealthService';
import { PublishReadinessChecklist } from '@/components/admin/content-health/PublishReadinessChecklist';
import i18n from '@/i18n';

interface IssueRowProps {
  issue: ContentHealthIssue;
  onPublished: () => void;
}

const entityIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  recipe: 'restaurant-outline',
  ingredient: 'leaf-outline',
  useful_item: 'cube-outline',
};

interface Badge {
  label: string;
  color: string;
  bgColor: string;
}

function getIssueBadges(issue: ContentHealthIssue): Badge[] {
  const t = (key: string) => i18n.t(`admin.contentHealth.${key}`);
  const badges: Badge[] = [];

  if (issue.missingEn) {
    badges.push({ label: t('noEn'), color: COLORS.status.warning, bgColor: COLORS.status.warning + '1A' });
  }
  if (issue.missingEs) {
    badges.push({ label: t('noEs'), color: COLORS.status.warning, bgColor: COLORS.status.warning + '1A' });
  }
  if (issue.missingImage) {
    badges.push({ label: t('noImage'), color: COLORS.status.error, bgColor: COLORS.status.error + '1A' });
  }
  if (issue.missingNutrition) {
    badges.push({ label: t('noNutrition'), color: COLORS.primary.darkest, bgColor: COLORS.primary.darkest + '1A' });
  }
  if (issue.isPublished === false) {
    badges.push({ label: t('draft'), color: COLORS.text.secondary, bgColor: COLORS.grey.light });
  }

  return badges;
}

export function IssueRow({ issue, onPublished }: IssueRowProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const t = (key: string) => i18n.t(`admin.contentHealth.${key}`);

  const icon = entityIcons[issue.entityType] ?? 'help-circle-outline';
  const badges = getIssueBadges(issue);
  const isUnpublishedRecipe = issue.entityType === 'recipe' && issue.isPublished === false;

  const handleFix = () => {
    switch (issue.entityType) {
      case 'recipe':
        router.push(`/admin/recipes/${issue.id}` as never);
        break;
      case 'ingredient':
        router.push('/admin/ingredients' as never);
        break;
      case 'useful_item':
        router.push('/admin/kitchen-tools' as never);
        break;
    }
  };

  return (
    <View className="bg-white rounded-md mb-xs overflow-hidden">
      <View className="flex-row items-center px-md py-sm">
        <Ionicons name={icon} size={20} color={COLORS.text.secondary} />
        <View className="flex-1 ml-sm">
          <Text preset="body" className="text-text-default" numberOfLines={1}>
            {issue.name}
          </Text>
          <View className="flex-row flex-wrap mt-xxs gap-xxs">
            {badges.map((badge) => (
              <View
                key={badge.label}
                className="px-xs py-xxxs rounded-sm"
                style={{ backgroundColor: badge.bgColor }}
              >
                <Text preset="caption" style={{ color: badge.color, fontSize: 11 }}>
                  {badge.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <View className="flex-row items-center gap-xs">
          {isUnpublishedRecipe && (
            <TouchableOpacity
              onPress={() => setExpanded(!expanded)}
              className="px-xs py-xxs"
            >
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={COLORS.text.secondary}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            className="px-sm py-xs bg-primary-medium rounded-md"
            onPress={handleFix}
            activeOpacity={0.7}
          >
            <Text preset="bodySmall" className="text-text-default font-semibold">
              {t('fix')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      {isUnpublishedRecipe && expanded && (
        <View className="px-md pb-sm">
          <PublishReadinessChecklist issue={issue} onPublished={onPublished} />
        </View>
      )}
    </View>
  );
}
