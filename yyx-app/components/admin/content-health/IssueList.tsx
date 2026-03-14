import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/common/Text';
import { ContentHealthIssue } from '@/services/admin/adminContentHealthService';
import { IssueRow } from '@/components/admin/content-health/IssueRow';
import i18n from '@/i18n';

interface IssueListProps {
  issues: ContentHealthIssue[];
  count: number;
  onPublished: () => void;
}

export function IssueList({ issues, count, onPublished }: IssueListProps) {
  const t = (key: string, opts?: Record<string, unknown>) =>
    i18n.t(`admin.contentHealth.${key}`, opts);

  if (issues.length === 0) {
    return (
      <View className="items-center py-xl">
        <Text preset="body" className="text-text-secondary">
          {t('noIssues')}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text preset="caption" className="text-text-secondary mb-sm">
        {t('issueCount', { count })}
      </Text>
      {issues.map((issue) => (
        <IssueRow key={`${issue.entityType}-${issue.id}`} issue={issue} onPublished={onPublished} />
      ))}
    </View>
  );
}
