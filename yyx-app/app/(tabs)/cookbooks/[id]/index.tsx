import React from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PageLayout } from '@/components/layouts/PageLayout';
import { Text } from '@/components/common';
import { CookbookHeader, CookbookRecipeList } from '@/components/cookbook';
import { useCookbookQuery } from '@/hooks/useCookbookQuery';
import { useAuth } from '@/contexts/AuthContext';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

export default function CookbookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data: cookbook, isLoading, error } = useCookbookQuery(id || '');

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
          onDelete={() => router.back()}
        />

        {/* Recipes List */}
        <View className="flex-1">
          <CookbookRecipeList
            recipes={cookbook.recipes}
            cookbookId={cookbook.id}
            isOwner={isOwner}
          />
        </View>
      </View>
    </PageLayout>
  );
}
