import React, { useMemo, useState } from 'react';
import { View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { PageLayout } from '@/components/layouts/PageLayout';
import { Text, Toast } from '@/components/common';
import {
  CookbookList,
  CreateEditCookbookModal,
  CookbookSortBar,
} from '@/components/cookbook';
import {
  useUserCookbooksQuery,
  useCreateCookbook,
} from '@/hooks/useCookbookQuery';
import { useToast } from '@/hooks/useToast';
import { Cookbook, CreateCookbookInput } from '@/types/cookbook.types';
import { eventService } from '@/services/eventService';
import i18n from '@/i18n';
import type { CookbookSortOption } from '@/components/cookbook/CookbookSortBar';

export default function CookbooksScreen() {
  const router = useRouter();
  const { data: cookbooks = [], isLoading, refetch } = useUserCookbooksQuery();
  const createMutation = useCreateCookbook();
  const { toast, showToast, dismissToast } = useToast();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sortBy, setSortBy] = useState<CookbookSortOption>('recent');

  const sortedCookbooks = useMemo(() => {
    const list = [...cookbooks];
    return list.sort((a, b) => {
      if (a.isDefault !== b.isDefault) {
        return a.isDefault ? -1 : 1;
      }
      if (sortBy === 'mostRecipes') {
        if (b.recipeCount !== a.recipeCount) {
          return b.recipeCount - a.recipeCount;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'alphabetical') {
        return a.name.localeCompare(b.name);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [cookbooks, sortBy]);

  const handleCookbookPress = (cookbook: Cookbook) => {
    router.push(`/(tabs)/cookbooks/${cookbook.id}`);
  };

  const handleCreateCookbook = async (input: CreateCookbookInput) => {
    try {
      await createMutation.mutateAsync(input);
      setShowCreateModal(false);
      showToast({ message: i18n.t('cookbooks.toasts.created'), type: 'success' });
      eventService.logCookbookCreated(input.name);
    } catch (_error) {
      Alert.alert(
        i18n.t('common.errors.title'),
        i18n.t('cookbooks.errors.createFailed')
      );
    }
  };

  return (
    <PageLayout
      header={
        <View className="bg-primary-lightest border-b border-neutral-100">
          <View className="p-lg pt-xl">
            <Text preset="h1">{i18n.t('cookbooks.title')}</Text>
            <Text preset="body" className="text-text-secondary mt-xs">
              {i18n.t('cookbooks.subtitle')}
            </Text>
          </View>
        </View>
      }
    >
      <View className="flex-1 bg-primary-lightest">
        {cookbooks.length > 1 && (
          <CookbookSortBar value={sortBy} onChange={setSortBy} />
        )}
        <CookbookList
          cookbooks={sortedCookbooks}
          onCookbookPress={handleCookbookPress}
          onCreatePress={() => setShowCreateModal(true)}
          isLoading={isLoading}
          onRefresh={refetch}
        />
      </View>

      <CreateEditCookbookModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreateCookbook}
        isLoading={createMutation.isPending}
      />

      <Toast toast={toast} onDismiss={dismissToast} />
    </PageLayout>
  );
}
