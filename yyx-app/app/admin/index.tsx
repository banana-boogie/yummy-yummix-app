import React, { useEffect, useState } from 'react';
import { View, Pressable, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { adminRecipeService } from '@/services/admin/adminRecipeService';
import { adminContentHealthService, ContentHealthSummary } from '@/services/admin/adminContentHealthService';
import { AdminRecipe, pickTranslation } from '@/types/recipe.admin.types';
import { useRouter } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import i18n from '@/i18n';
import logger from '@/services/logger';

// =============================================================================
// Navigation helpers
// =============================================================================

function navTo(router: ReturnType<typeof useRouter>, route: string) {
  if (Platform.OS === 'web') {
    window.open(route, '_blank');
  } else {
    router.push(route as any);
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// =============================================================================
// Dashboard
// =============================================================================

export default function AdminDashboard() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<AdminRecipe[]>([]);
  const [healthSummary, setHealthSummary] = useState<ContentHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [recipeData, healthData] = await Promise.all([
          adminRecipeService.getAllRecipesForAdmin(),
          adminContentHealthService.getContentHealth().catch(() => null),
        ]);
        setRecipes(recipeData);
        if (healthData) setHealthSummary(healthData.summary);
      } catch (error) {
        logger.error('Dashboard load error:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const publishedCount = recipes.filter(r => r.isPublished).length;
  const draftCount = recipes.filter(r => !r.isPublished).length;
  const totalCount = recipes.length;
  const publishPercent = totalCount > 0 ? Math.round((publishedCount / totalCount) * 100) : 0;

  const recentRecipes = [...recipes]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
    .slice(0, 5);

  if (loading) {
    return (
      <AdminLayout title="Dashboard">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={COLORS.primary.darkest} />
        </View>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Dashboard">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, maxWidth: 900 }}>

        {/* Section A: Pipeline Progress */}
        <View className="mb-xl">
          <View className="flex-row justify-between items-center mb-xs">
            <Text preset="h3" className="text-text-default">Publishing Progress</Text>
            <Text preset="caption" className="text-text-secondary">
              {publishedCount} of {totalCount}
            </Text>
          </View>
          <View className="bg-grey-light rounded-full h-[12px] overflow-hidden">
            <View
              className="bg-status-success h-full rounded-full"
              style={{ width: `${Math.max(publishPercent, 1)}%` }}
            />
          </View>
          <Pressable onPress={() => navTo(router, '/admin/recipes')}>
            <Text preset="bodySmall" className="text-text-secondary mt-xs">
              {draftCount} drafts to review →
            </Text>
          </Pressable>
        </View>

        {/* Section B: Content Blockers */}
        {healthSummary && (
          <View className="flex-row gap-sm mb-xl flex-wrap">
            <BlockerCard
              icon="language-outline"
              count={healthSummary.missingTranslations.total}
              label="Need translations"
              color={COLORS.status.warning}
              onPress={() => navTo(router, '/admin/content-health')}
            />
            <BlockerCard
              icon="image-outline"
              count={healthSummary.missingImages.total}
              label="Need images"
              color={COLORS.status.error}
              onPress={() => navTo(router, '/admin/content-health')}
            />
            <BlockerCard
              icon="nutrition-outline"
              count={healthSummary.missingNutrition.total}
              label="Need nutrition"
              color={COLORS.status.warning}
              onPress={() => navTo(router, '/admin/content-health')}
            />
          </View>
        )}

        {/* Section C: Primary Action */}
        <View className="mb-xl">
          <Button
            variant="primary"
            size="large"
            icon={<Ionicons name="add-circle-outline" size={22} color={COLORS.neutral.white} />}
            onPress={() => navTo(router, '/admin/recipes/new')}
          >
            Create New Recipe
          </Button>
        </View>

        {/* Section D: Recent Recipes */}
        {recentRecipes.length > 0 && (
          <View className="mb-xl">
            <View className="flex-row justify-between items-center mb-sm">
              <Text preset="h3" className="text-text-default">Recent Recipes</Text>
              <Pressable onPress={() => navTo(router, '/admin/recipes')}>
                <Text preset="bodySmall" className="text-primary-darkest">View all →</Text>
              </Pressable>
            </View>
            {recentRecipes.map((recipe) => {
              const t = pickTranslation(recipe.translations, i18n.locale);
              const name = t?.name || 'Untitled';
              const updatedAt = recipe.updatedAt || recipe.createdAt;
              return (
                <Pressable
                  key={recipe.id}
                  className="bg-white rounded-md p-md shadow-sm mb-xs flex-row items-center"
                  onPress={() => navTo(router, `/admin/recipes/${recipe.id}`)}
                >
                  <View className="flex-1">
                    <Text preset="body" className="text-text-default" numberOfLines={1}>{name}</Text>
                    <Text preset="caption" className="text-text-secondary">
                      Updated {timeAgo(updatedAt)}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-xs">
                    {!recipe.pictureUrl && (
                      <Ionicons name="image-outline" size={16} color={COLORS.status.error} />
                    )}
                    <View className={`px-sm py-xxs rounded-full ${recipe.isPublished ? 'bg-status-success' : 'bg-grey-light'}`}>
                      <Text preset="caption" className={recipe.isPublished ? 'text-white' : 'text-text-secondary'}>
                        {recipe.isPublished ? 'Live' : 'Draft'}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Section E: Catalog Navigation */}
        <Text preset="h3" className="text-text-default mb-sm">Manage</Text>
        <View className="flex-row flex-wrap gap-sm">
          {[
            { icon: 'restaurant-outline', label: 'Recipes', route: '/admin/recipes' },
            { icon: 'leaf-outline', label: 'Ingredients', route: '/admin/ingredients' },
            { icon: 'build-outline', label: 'Kitchen Tools', route: '/admin/kitchen-tools' },
            { icon: 'pricetag-outline', label: 'Tags', route: '/admin/tags' },
            { icon: 'analytics-outline', label: 'Analytics', route: '/admin/analytics' },
            { icon: 'medkit-outline', label: 'Content Health', route: '/admin/content-health' },
            { icon: 'people-outline', label: 'User Recipes', route: '/admin/user-recipes' },
          ].map((item) => (
            <Pressable
              key={item.route}
              className="bg-primary-lightest rounded-md p-md items-center"
              style={{ minWidth: 100, width: '30%' }}
              onPress={() => navTo(router, item.route)}
            >
              <Ionicons name={item.icon as any} size={24} color={COLORS.text.secondary} />
              <Text preset="bodySmall" className="text-text-default mt-xs text-center">{item.label}</Text>
            </Pressable>
          ))}
        </View>

      </ScrollView>
    </AdminLayout>
  );
}

// =============================================================================
// Subcomponents
// =============================================================================

function BlockerCard({ icon, count, label, color, onPress }: {
  icon: string;
  count: number;
  label: string;
  color: string;
  onPress: () => void;
}) {
  const resolved = count === 0;
  return (
    <Pressable
      className="bg-white rounded-md p-md shadow-sm flex-1"
      style={{ minWidth: 120 }}
      onPress={onPress}
    >
      <Ionicons
        name={resolved ? 'checkmark-circle' : (icon as any)}
        size={20}
        color={resolved ? COLORS.status.success : color}
      />
      <Text
        preset="h3"
        className="mt-xs"
        style={{ color: resolved ? COLORS.status.success : color }}
      >
        {count}
      </Text>
      <Text preset="caption" className="text-text-secondary">{label}</Text>
    </Pressable>
  );
}
