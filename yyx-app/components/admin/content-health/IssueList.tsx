import React, { useCallback } from 'react';
import { View, FlatList } from 'react-native';
import { Text } from '@/components/common/Text';
import { ContentHealthIssue } from '@/services/admin/adminContentHealthService';
import { IssueRow } from '@/components/admin/content-health/IssueRow';
import i18n from '@/i18n';

interface IssueListProps {
  issues: ContentHealthIssue[];
  count: number;
  onPublished: () => void;
  ListHeaderComponent?: React.ReactElement;
}

export function IssueList({ issues, count, onPublished, ListHeaderComponent }: IssueListProps) {
  const t = (key: string, opts?: Record<string, unknown>) =>
    i18n.t(`admin.contentHealth.${key}`, opts);

  const renderItem = useCallback(
    ({ item }: { item: ContentHealthIssue }) => (
      <IssueRow issue={item} onPublished={onPublished} />
    ),
    [onPublished],
  );

  const keyExtractor = useCallback(
    (item: ContentHealthIssue) => `${item.entityType}-${item.id}`,
    [],
  );

  const header = (
    <>
      {ListHeaderComponent}
      {issues.length > 0 && (
        <Text preset="caption" className="text-text-secondary mb-sm">
          {t('issueCount', { count })}
        </Text>
      )}
    </>
  );

  const emptyComponent = (
    <View className="items-center py-xl">
      <Text preset="body" className="text-text-secondary">
        {t('noIssues')}
      </Text>
    </View>
  );

  return (
    <FlatList
      data={issues}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={header}
      ListEmptyComponent={emptyComponent}
      contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      className="flex-1 bg-background-default"
    />
  );
}
