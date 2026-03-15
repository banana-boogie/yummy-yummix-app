import React, { useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Text } from '@/components/common/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { ContentHealthIssue } from '@/services/admin/adminContentHealthService';
import { adminContentHealthService } from '@/services/admin/adminContentHealthService';
import i18n from '@/i18n';

interface PublishReadinessChecklistProps {
  issue: ContentHealthIssue;
  onPublished: () => void;
}

interface CheckItem {
  labelKey: string;
  passed: boolean;
}

export function PublishReadinessChecklist({ issue, onPublished }: PublishReadinessChecklistProps) {
  const [publishing, setPublishing] = useState(false);

  const t = (key: string) => i18n.t(`admin.contentHealth.${key}`);

  const checks: CheckItem[] = [
    { labelKey: 'hasEnName', passed: !issue.missingEn },
    { labelKey: 'hasEsName', passed: !issue.missingEs },
    { labelKey: 'hasImage', passed: !issue.missingImage },
    { labelKey: 'hasSteps', passed: (issue.stepCount ?? 0) > 0 },
    { labelKey: 'hasIngredients', passed: (issue.ingredientCount ?? 0) > 0 },
  ];

  const allPassed = checks.every((c) => c.passed);

  const handlePublish = async () => {
    if (!allPassed || publishing) return;
    setPublishing(true);
    try {
      await adminContentHealthService.publishRecipe(issue.id);
      onPublished();
    } catch (err) {
      const message = err instanceof Error ? err.message : i18n.t('admin.contentHealth.publishError');
      Alert.alert(i18n.t('admin.contentHealth.publishError'), message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <View className="mt-xs ml-lg pl-md border-l-2 border-border-default">
      {checks.map((check) => (
        <View key={check.labelKey} className="flex-row items-center mb-xxs">
          <Ionicons
            name={check.passed ? 'checkmark-circle' : 'close-circle'}
            size={16}
            color={check.passed ? COLORS.status.success : COLORS.status.error}
          />
          <Text preset="caption" className="ml-xs text-text-secondary">
            {t(check.labelKey)}
          </Text>
        </View>
      ))}
      <TouchableOpacity
        className={`mt-xs px-md py-xs rounded-md self-start ${allPassed ? 'bg-status-success' : 'bg-grey-default'}`}
        onPress={handlePublish}
        disabled={!allPassed || publishing}
        activeOpacity={0.7}
      >
        {publishing ? (
          <ActivityIndicator size="small" color={COLORS.neutral.white} />
        ) : (
          <Text
            preset="bodySmall"
            className={allPassed ? 'text-white font-semibold' : 'text-text-secondary'}
          >
            {allPassed ? t('publish') : t('publishNotReady')}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
