import React from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Text } from '@/components/common/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { HealthSummaryCards } from '@/components/admin/content-health/HealthSummaryCards';
import { FilterBar } from '@/components/admin/content-health/FilterBar';
import { IssueList } from '@/components/admin/content-health/IssueList';
import { useContentHealth } from '@/hooks/admin/useContentHealth';
import i18n from '@/i18n';

function LoadingState() {
  return (
    <View className="items-center justify-center py-xxl">
      <ActivityIndicator size="large" color={COLORS.primary.default} />
      <Text preset="body" className="text-text-secondary mt-md">
        {i18n.t('admin.contentHealth.loading')}
      </Text>
    </View>
  );
}

function ErrorState({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  return (
    <View className="items-center justify-center py-xxl">
      <Ionicons name="alert-circle" size={48} color={COLORS.status.error} />
      <Text preset="body" className="text-text-default mt-md">
        {i18n.t('admin.contentHealth.error')}
      </Text>
      {error?.message && (
        <Text preset="caption" className="text-text-secondary mt-xs px-lg text-center">
          {error.message}
        </Text>
      )}
      <TouchableOpacity
        className="mt-md px-lg py-sm bg-primary-medium rounded-lg"
        onPress={onRetry}
      >
        <Text preset="body" className="text-text-default font-semibold">
          {i18n.t('admin.contentHealth.retry')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ContentHealthScreen() {
  const {
    data,
    loading,
    error,
    refresh,
    activeFilter,
    setActiveFilter,
    entityFilter,
    setEntityFilter,
    filteredIssues,
    filteredCount,
  } = useContentHealth();

  const renderContent = () => {
    if (loading) return <LoadingState />;
    if (error) return <ErrorState error={error} onRetry={refresh} />;
    if (!data) return null;

    return (
      <>
        <HealthSummaryCards
          summary={data.summary}
          activeFilter={activeFilter}
          onFilterSelect={setActiveFilter}
        />
        <FilterBar
          activeFilter={activeFilter}
          entityFilter={entityFilter}
          onActiveFilterChange={setActiveFilter}
          onEntityFilterChange={setEntityFilter}
        />
        <IssueList
          issues={filteredIssues}
          count={filteredCount}
          onPublished={refresh}
        />
      </>
    );
  };

  return (
    <AdminLayout title={i18n.t('admin.contentHealth.title')}>
      <ScrollView
        className="flex-1 bg-background-default"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      >
        {renderContent()}
      </ScrollView>
    </AdminLayout>
  );
}
