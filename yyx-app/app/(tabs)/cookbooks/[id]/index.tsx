import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PageLayout } from '@/components/layouts/PageLayout';
import { Text, Toast } from '@/components/common';
import { CookbookHeader, CookbookRecipeList } from '@/components/cookbook';
import { useCookbookQuery } from '@/hooks/useCookbookQuery';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/contexts/AuthContext';
import { eventService } from '@/services/eventService';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

export default function CookbookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { toast, showToast, dismissToast } = useToast();

  const { data: cookbook, isLoading, error, refetch } = useCookbookQuery(id || '');

  // Track cookbook view
  useEffect(() => {
    if (id) {
      eventService.logCookbookViewed(id);
    }
  }, [id]);

  if (isLoading) {
    return (
      <PageLayout>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.primary.medium} />
        </View>
      </PageLayout>
    );
  }

  if (error || !cookbook) {
    return (
      <PageLayout>
        <View className="flex-1 items-center justify-center p-lg">
          <Text preset="h2" className="text-text-secondary text-center">
            {i18n.t('cookbooks.notFound')}
          </Text>
          <Text preset="body" className="text-text-secondary text-center mt-sm">
            {i18n.t('cookbooks.notFoundDescription')}
          </Text>
        </View>
      </PageLayout>
    );
  }

  const isOwner = user?.id === cookbook.userId;

  return (
    <PageLayout maxWidth={900}>
      <View className="flex-1 bg-primary-lightest">
        {/* Header with gradient cover */}
        <CookbookHeader
          cookbook={cookbook}
          isOwner={isOwner}
          onDelete={() => {
            showToast({ message: i18n.t('cookbooks.toasts.deleted'), type: 'success' });
            eventService.logCookbookDeleted(cookbook.id);
            router.back();
          }}
          onUpdate={() => {
            showToast({ message: i18n.t('cookbooks.toasts.updated'), type: 'success' });
          }}
        />

        {/* Recipes List */}
        <View className="flex-1">
          <CookbookRecipeList
            recipes={cookbook.recipes}
            cookbookId={cookbook.id}
            isOwner={isOwner}
            onRefresh={refetch}
            onRecipeRemoved={() => {
              showToast({ message: i18n.t('cookbooks.toasts.recipeRemoved'), type: 'success' });
            }}
          />
        </View>
      </View>

      <Toast toast={toast} onDismiss={dismissToast} />
    </PageLayout>
  );
}
