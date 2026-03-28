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
import i18n from '@/i18n';
import logger from '@/services/logger';

// =============================================================================
// Navigation helpers
// =============================================================================

function navTo(router: ReturnType<typeof useRouter>, route: string, e?: { metaKey?: boolean; ctrlKey?: boolean }) {
  if (Platform.OS === 'web' && (e?.metaKey || e?.ctrlKey)) {
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
// Manage grid items
// =============================================================================

const manageItems = [
  { icon: 'analytics-outline', label: 'Analytics', desc: 'Usage & engagement', route: '/admin/analytics' },
  { icon: 'medkit-outline', label: 'Content Health', desc: 'Audit missing data', route: '/admin/content-health' },
  { icon: 'leaf-outline', label: 'Ingredients', desc: 'Ingredient library', route: '/admin/ingredients' },
  { icon: 'build-outline', label: 'Kitchen Tools', desc: 'Equipment library', route: '/admin/kitchen-tools' },
  { icon: 'restaurant-outline', label: 'Recipes', desc: 'Manage catalog', route: '/admin/recipes' },
  { icon: 'pricetag-outline', label: 'Tags', desc: 'Recipe categories', route: '/admin/tags' },
  { icon: 'people-outline', label: 'User Recipes', desc: 'AI-generated recipes', route: '/admin/user-recipes' },
];

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
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 32, maxWidth: 900 }}>

        {/* Section A: Manage */}
        <Text preset="h3" className="text-text-default mb-md">Manage</Text>
        <View className="flex-row flex-wrap gap-md mb-xxl">
          {manageItems.map((item) => (
            <ManageCard
              key={item.route}
              icon={item.icon}
              label={item.label}
              desc={item.desc}
              onPress={(e) => navTo(router, item.route, e as any)}
            />
          ))}
          {/* Create recipe card — visually distinct */}
          <Pressable
            className="rounded-lg p-md items-center justify-center border-2 border-dashed border-primary-medium"
            style={({ pressed }: any) => [
              { minWidth: 110, width: '22%', opacity: pressed ? 0.7 : 1 },
              Platform.OS === 'web' ? { cursor: 'pointer' } as any : {},
            ]}
            onPress={(e) => navTo(router, '/admin/recipes/new', e as any)}
          >
            <Ionicons name="add-circle-outline" size={24} color={COLORS.primary.darkest} />
            <Text preset="bodySmall" className="text-primary-darkest mt-xs text-center font-semibold">New Recipe</Text>
          </Pressable>
        </View>

        {/* Section B: Pipeline Progress */}
        <View className="mb-xxl">
          <View className="flex-row justify-between items-center mb-sm">
            <Text preset="h3" className="text-text-default">Publishing Progress</Text>
            <Text preset="body" className="text-text-default font-semibold">
              {publishPercent}%
            </Text>
          </View>
          <View className="bg-grey-light rounded-full h-[14px] overflow-hidden">
            <View
              className="bg-status-success h-full rounded-full"
              style={{ width: `${Math.max(publishPercent, 2)}%`, minWidth: 8 }}
            />
          </View>
          <View className="flex-row justify-between items-center mt-sm">
            <Pressable
              onPress={(e) => navTo(router, '/admin/recipes', e as any)}
              style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}}
            >
              <Text preset="bodySmall" className="text-text-secondary">
                {draftCount} drafts to review →
              </Text>
            </Pressable>
            <Text preset="caption" className="text-text-secondary">
              {publishedCount} published · {totalCount} total
            </Text>
          </View>
        </View>

        {/* Section C: Content Blockers */}
        {healthSummary && (
          <View className="mb-xxl">
            <Text preset="h3" className="text-text-default mb-md">Content Issues</Text>
            <View className="flex-row gap-md flex-wrap">
              <BlockerCard
                icon="language-outline"
                count={healthSummary.missingTranslations.total}
                label="Need translations"
                color={COLORS.status.warning}
                onPress={(e) => navTo(router, '/admin/content-health', e as any)}
              />
              <BlockerCard
                icon="image-outline"
                count={healthSummary.missingImages.total}
                label="Need images"
                color={COLORS.status.error}
                onPress={(e) => navTo(router, '/admin/content-health', e as any)}
              />
              <BlockerCard
                icon="nutrition-outline"
                count={healthSummary.missingNutrition.total}
                label="Need nutrition"
                color={COLORS.status.warning}
                onPress={(e) => navTo(router, '/admin/content-health', e as any)}
              />
            </View>
          </View>
        )}

        {/* Section D: Recent Recipes */}
        {recentRecipes.length > 0 && (
          <View className="mb-xxl">
            <View className="flex-row justify-between items-center mb-md">
              <Text preset="h3" className="text-text-default">Recent Recipes</Text>
              <Pressable
                onPress={(e) => navTo(router, '/admin/recipes', e as any)}
                style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}}
              >
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
                  className="bg-white rounded-md p-md mb-sm flex-row items-center"
                  style={({ pressed }: any) => [
                    { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
                    pressed ? { opacity: 0.7 } : {},
                    Platform.OS === 'web' ? { cursor: 'pointer' } as any : {},
                  ]}
                  onPress={(e) => navTo(router, `/admin/recipes/${recipe.id}`, e as any)}
                >
                  <View className="flex-1">
                    <Text preset="body" className="text-text-default" numberOfLines={1}>{name}</Text>
                    <Text preset="caption" className="text-text-secondary">
                      Updated {timeAgo(updatedAt)}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-sm">
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

      </ScrollView>
    </AdminLayout>
  );
}

// =============================================================================
// Subcomponents
// =============================================================================

function ManageCard({ icon, label, desc, onPress }: {
  icon: string;
  label: string;
  desc: string;
  onPress: (e: any) => void;
}) {
  return (
    <Pressable
      className="bg-primary-lightest rounded-lg p-md"
      style={({ pressed }: any) => [
        { minWidth: 110, width: '22%', opacity: pressed ? 0.7 : 1 },
        Platform.OS === 'web' ? { cursor: 'pointer' } as any : {},
      ]}
      onPress={onPress}
    >
      <Ionicons name={icon as any} size={22} color={COLORS.text.secondary} />
      <Text preset="bodySmall" className="text-text-default mt-sm font-semibold">{label}</Text>
      <Text preset="caption" className="text-text-secondary mt-xxs">{desc}</Text>
    </Pressable>
  );
}

function BlockerCard({ icon, count, label, color, onPress }: {
  icon: string;
  count: number;
  label: string;
  color: string;
  onPress: (e: any) => void;
}) {
  const resolved = count === 0;
  const borderColor = resolved ? COLORS.status.success : color;

  return (
    <Pressable
      className="bg-white rounded-lg p-lg flex-1"
      style={({ pressed }: any) => [
        {
          minWidth: 140,
          borderLeftWidth: 4,
          borderLeftColor: borderColor,
          shadowColor: '#000',
          shadowOpacity: 0.05,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
          opacity: pressed ? 0.7 : 1,
        },
        Platform.OS === 'web' ? { cursor: 'pointer' } as any : {},
      ]}
      onPress={onPress}
    >
      <View className="flex-row items-center gap-sm">
        <Ionicons
          name={resolved ? 'checkmark-circle' : (icon as any)}
          size={20}
          color={resolved ? COLORS.status.success : color}
        />
        <Text
          preset="h2"
          style={{ color: resolved ? COLORS.status.success : color }}
        >
          {count}
        </Text>
      </View>
      <Text preset="bodySmall" className="text-text-secondary mt-sm">{label}</Text>
    </Pressable>
  );
}
