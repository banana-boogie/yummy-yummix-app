import React, { useState, useEffect } from 'react';
import { ScrollView, View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Text } from '@/components/common/Text';
import { COLORS } from '@/constants/design-tokens';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import i18n from '@/i18n';

interface UserRecipe {
  id: string;
  userId: string;
  userName: string | null;
  name: string;
  description: string | null;
  source: string;
  difficulty: string | null;
  prepTime: number | null;
  totalTime: number | null;
  portions: number | null;
  language: string | null;
  createdAt: string;
  recipeData: {
    ingredients?: { name: string; quantity?: string; unit?: string; notes?: string }[];
    steps?: { instruction: string; thermomixTime?: number; thermomixTemp?: number; thermomixSpeed?: number }[];
    tipsAndTricks?: string;
  } | null;
}

export default function UserRecipeDetailPage() {
  const { id } = useLocalSearchParams();
  const [recipe, setRecipe] = useState<UserRecipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loadRecipe(id as string);
  }, [id]);

  const loadRecipe = async (recipeId: string) => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('user_recipes')
        .select('id, user_id, name, description, source, difficulty, prep_time, total_time, portions, language, created_at, recipe_data')
        .eq('id', recipeId)
        .single();

      if (fetchError) throw fetchError;

      // Get user profile
      let userName: string | null = null;
      if (data.user_id) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('name, email')
          .eq('id', data.user_id)
          .single();
        userName = profile?.name || profile?.email || null;
      }

      setRecipe({
        id: data.id,
        userId: data.user_id,
        userName,
        name: data.name,
        description: data.description,
        source: data.source,
        difficulty: data.difficulty,
        prepTime: data.prep_time,
        totalTime: data.total_time,
        portions: data.portions,
        language: data.language,
        createdAt: data.created_at,
        recipeData: data.recipe_data,
      });
    } catch (err) {
      setError(i18n.t('admin.recipes.form.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title={i18n.t('admin.common.loading')} showBackButton>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={COLORS.primary.default} />
        </View>
      </AdminLayout>
    );
  }

  if (error || !recipe) {
    return (
      <AdminLayout title={i18n.t('admin.recipes.form.errors.loadFailed')} showBackButton>
        <View className="flex-1 justify-center items-center p-lg">
          <Ionicons name="alert-circle" size={48} color={COLORS.status.error} />
          <Text preset="body" className="text-text-secondary mt-md">{error || i18n.t('admin.recipes.list.noRecipes')}</Text>
        </View>
      </AdminLayout>
    );
  }

  const ingredients = recipe.recipeData?.ingredients ?? [];
  const steps = recipe.recipeData?.steps ?? [];

  return (
    <AdminLayout title={recipe.name} showBackButton>
      <ScrollView
        className="flex-1 bg-background-default"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      >
        {/* Source badge */}
        <View className="flex-row items-center mb-md">
          <View className="bg-primary-medium px-sm py-xxs rounded-full mr-sm">
            <Text preset="caption" className="text-text-default font-semibold">
              {i18n.t('admin.analytics.labels.aiGenerated')}
            </Text>
          </View>
          {recipe.userName && (
            <Text preset="body" className="text-text-secondary">
              {i18n.t('admin.userRecipes.createdBy', { name: recipe.userName })}
            </Text>
          )}
        </View>

        {/* Basic info */}
        <View className="bg-white rounded-lg p-md mb-md shadow-sm">
          <Text preset="h2" className="text-text-default mb-sm">{recipe.name}</Text>
          {recipe.description && (
            <Text preset="body" className="text-text-secondary mb-sm">{recipe.description}</Text>
          )}
          <View className="flex-row flex-wrap gap-md">
            {recipe.difficulty && (
              <InfoChip icon="speedometer" label={recipe.difficulty} />
            )}
            {recipe.prepTime != null && (
              <InfoChip icon="timer" label={i18n.t('admin.userRecipes.prepTime', { minutes: recipe.prepTime })} />
            )}
            {recipe.totalTime != null && (
              <InfoChip icon="time" label={i18n.t('admin.userRecipes.totalTime', { minutes: recipe.totalTime })} />
            )}
            {recipe.portions != null && (
              <InfoChip icon="people" label={i18n.t('admin.userRecipes.portions', { count: recipe.portions })} />
            )}
            {recipe.language && (
              <InfoChip icon="globe" label={recipe.language.toUpperCase()} />
            )}
          </View>
          <Text preset="caption" className="text-text-secondary mt-sm">
            {new Date(recipe.createdAt).toLocaleDateString()}
          </Text>
        </View>

        {/* Ingredients */}
        {ingredients.length > 0 && (
          <View className="bg-white rounded-lg p-md mb-md shadow-sm">
            <Text preset="h2" className="text-text-default mb-sm">
              {i18n.t('admin.recipes.form.ingredientsInfo.title')}
            </Text>
            {ingredients.map((ing, i) => (
              <View key={i} className="flex-row py-xs border-b border-border-default">
                <Text preset="body" className="text-text-default flex-1">
                  {ing.quantity ? `${ing.quantity} ` : ''}{ing.unit ? `${ing.unit} ` : ''}{ing.name}
                </Text>
                {ing.notes && (
                  <Text preset="caption" className="text-text-secondary">({ing.notes})</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Steps */}
        {steps.length > 0 && (
          <View className="bg-white rounded-lg p-md mb-md shadow-sm">
            <Text preset="h2" className="text-text-default mb-sm">
              {i18n.t('admin.recipes.form.stepsInfo.title')}
            </Text>
            {steps.map((step, i) => (
              <View key={i} className="mb-md">
                <Text preset="body" className="text-text-default font-semibold mb-xxs">
                  {i18n.t('admin.recipes.form.stepsInfo.instruction')} {i + 1}
                </Text>
                <Text preset="body" className="text-text-default">{step.instruction}</Text>
                {(step.thermomixTime != null || step.thermomixTemp != null || step.thermomixSpeed != null) && (
                  <View className="flex-row gap-sm mt-xs">
                    {step.thermomixTime != null && (
                      <Text preset="caption" className="text-primary-darkest">
                        {step.thermomixTime}s
                      </Text>
                    )}
                    {step.thermomixTemp != null && (
                      <Text preset="caption" className="text-primary-darkest">
                        {step.thermomixTemp}°
                      </Text>
                    )}
                    {step.thermomixSpeed != null && (
                      <Text preset="caption" className="text-primary-darkest">
                        {i18n.t('admin.userRecipes.speed', { value: step.thermomixSpeed })}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Tips */}
        {recipe.recipeData?.tipsAndTricks && (
          <View className="bg-white rounded-lg p-md mb-md shadow-sm">
            <Text preset="h2" className="text-text-default mb-sm">
              {i18n.t('admin.recipes.form.basicInfo.tipsAndTricksEnglish')}
            </Text>
            <Text preset="body" className="text-text-default">{recipe.recipeData.tipsAndTricks}</Text>
          </View>
        )}
      </ScrollView>
    </AdminLayout>
  );
}

function InfoChip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View className="flex-row items-center">
      <Ionicons name={icon} size={14} color={COLORS.text.secondary} style={{ marginRight: 4 }} />
      <Text preset="caption" className="text-text-secondary">{label}</Text>
    </View>
  );
}
