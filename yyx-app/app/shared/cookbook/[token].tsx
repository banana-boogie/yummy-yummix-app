import React from 'react';
import { View, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PageLayout } from '@/components/layouts/PageLayout';
import { Text, Button } from '@/components/common';
import { CookbookRecipeList } from '@/components/cookbook';
import { useSharedCookbookQuery } from '@/hooks/useCookbookQuery';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/i18n';

/**
 * Public shared cookbook page
 * Accessible without authentication via share link
 */
export default function SharedCookbookScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data: cookbook, isLoading, error } = useSharedCookbookQuery(token || '');

  if (isLoading) {
    return (
      <PageLayout>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FFBFB7" />
          <Text preset="body" className="text-text-secondary mt-md">
            {i18n.t('common.loading')}...
          </Text>
        </View>
      </PageLayout>
    );
  }

  if (error || !cookbook) {
    return (
      <PageLayout>
        <View className="flex-1 items-center justify-center p-lg">
          <Ionicons name="lock-closed-outline" size={64} color="#ccc" />
          <Text preset="h2" className="text-text-secondary text-center mt-md">
            {i18n.t('cookbooks.notFound')}
          </Text>
          <Text preset="body" className="text-text-secondary text-center mt-sm">
            {i18n.t('cookbooks.notFoundDescription')}
          </Text>
        </View>
      </PageLayout>
    );
  }

  // Simple deterministic gradient generator based on ID
  const RAW_GRADIENTS = [
    ['#FF9A9E', '#FECFEF'],
    ['#a18cd1', '#fbc2eb'],
    ['#fa709a', '#fee140'],
    ['#ff9a9e', '#fecfef'],
    ['#f6d365', '#fda085'],
    ['#84fab0', '#8fd3f4'],
    ['#a1c4fd', '#c2e9fb'],
    ['#cfd9df', '#e2ebf0'],
  ];

  const getGradientForId = (id: string) => {
    if (!id) return RAW_GRADIENTS[0];
    const charCode = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
    return RAW_GRADIENTS[charCode % RAW_GRADIENTS.length];
  };

  const colors = getGradientForId(cookbook.id);
  const isOwner = user?.id === cookbook.userId;

  return (
    <PageLayout maxWidth={900}>
      <View className="flex-1 bg-primary-lightest">
        {/* Header */}
        <View
          className="w-full p-lg pt-xl justify-end"
          style={{ backgroundColor: colors[0], minHeight: 180 }}
        >
          {/* Back button */}
          <Pressable
            onPress={() => router.back()}
            className="absolute top-12 left-4 bg-white/30 rounded-full p-sm active:bg-white/50"
          >
            <Ionicons name="arrow-back" size={24} color="#2D2D2D" />
          </Pressable>

          <View className="flex-row items-center mb-xs">
            <Ionicons
              name={cookbook.isPublic ? 'globe-outline' : 'lock-closed'}
              size={18}
              color="#666"
              className="mr-xs"
            />
            <Text preset="caption" className="text-text-secondary">
              {cookbook.isPublic
                ? i18n.t('cookbooks.publicCookbook')
                : i18n.t('cookbooks.sharedCookbook')}
            </Text>
          </View>

          <Text preset="h1" className="text-text-primary mb-xs" numberOfLines={2}>
            {cookbook.name}
          </Text>

          {cookbook.description && (
            <Text
              preset="body"
              className="text-text-secondary mb-sm"
              numberOfLines={2}
            >
              {cookbook.description}
            </Text>
          )}

          <Text preset="caption" className="text-text-secondary">
            {cookbook.recipeCount}{' '}
            {cookbook.recipeCount === 1
              ? i18n.t('cookbooks.recipe')
              : i18n.t('cookbooks.recipes')}
          </Text>
        </View>

        {/* Call to action for unauthenticated users */}
        {!user && (
          <View className="bg-primary-medium/20 p-md mx-md mt-md rounded-md border border-primary-medium/30">
            <View className="flex-row items-center mb-sm">
              <Ionicons name="heart-outline" size={20} color="#D83A3A" />
              <Text preset="subheading" className="ml-sm">
                {i18n.t('cookbooks.likeThis')}
              </Text>
            </View>
            <Text preset="body" className="text-text-secondary mb-md">
              {i18n.t('cookbooks.signUpToSave')}
            </Text>
            <Button
              variant="primary"
              onPress={() => router.push('/auth/signup')}
              size="small"
            >
              {i18n.t('auth.common.signUp')}
            </Button>
          </View>
        )}

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
