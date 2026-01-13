import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { adminRecipeService } from '@/services/admin/adminRecipeService';
import { useRouter } from 'expo-router';
import { Text } from '@/components/common/Text';

export default function AdminDashboard() {
  const router = useRouter();
  const [recipeCount, setRecipeCount] = useState<number>(0);
  const [publishedCount, setPublishedCount] = useState<number>(0);
  const [draftCount, setDraftCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const recipes = await adminRecipeService.getAllRecipesForAdmin();
        setRecipeCount(recipes.length);
        setPublishedCount(recipes.filter(r => r.isPublished).length);
        setDraftCount(recipes.filter(r => !r.isPublished).length);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  return (
    <AdminLayout title="Admin Dashboard">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        <Text preset="h2" className="mb-md" color={COLORS.text.default}>Overview</Text>

        <View className="flex-col md:flex-row flex-wrap gap-md mb-xl">
          {/* Total Recipes Card */}
          <View className="bg-white rounded-lg p-lg shadow-md min-w-[200px] flex-row items-center">
            <View className="mr-md">
              <Ionicons name="restaurant" size={30} color={COLORS.text.secondary} />
            </View>
            <View>
              <Text preset="h1" color={COLORS.text.default}>{loading ? '...' : recipeCount}</Text>
              <Text preset="body" color={COLORS.text.secondary}>Total Recipes</Text>
            </View>
          </View>

          {/* Published Recipes Card */}
          <View className="bg-white rounded-lg p-lg shadow-md min-w-[200px] flex-row items-center">
            <View className="mr-md">
              <Ionicons name="checkmark-circle" size={30} color={COLORS.status.SUCCESS} />
            </View>
            <View>
              <Text preset="h1" color={COLORS.text.default}>{loading ? '...' : publishedCount}</Text>
              <Text preset="body" color={COLORS.text.secondary}>Published Recipes</Text>
            </View>
          </View>

          {/* Draft Recipes Card */}
          <View className="bg-white rounded-lg p-lg shadow-md min-w-[200px] flex-row items-center">
            <View className="mr-md">
              <Ionicons name="time" size={30} color={COLORS.status.WARNING} />
            </View>
            <View>
              <Text preset="h1" color={COLORS.text.default}>{loading ? '...' : draftCount}</Text>
              <Text preset="body" color={COLORS.text.secondary}>Draft Recipes</Text>
            </View>
          </View>
        </View>

        <Text preset="h2" className="mb-md" color={COLORS.text.default}>Quick Actions</Text>

        <View className="flex-row flex-wrap gap-sm">
          <TouchableOpacity
            className="bg-primary-default rounded-lg p-md flex-row items-center"
            style={{ width: '48%', minWidth: 150 }}
            onPress={() => router.push('/admin/recipes')}
          >
            <Ionicons name="list" size={22} color={COLORS.text.default} />
            <Text preset="body" className="ml-sm font-bold" numberOfLines={1} color={COLORS.text.default}>Recipes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-primary-default rounded-lg p-md flex-row items-center"
            style={{ width: '48%', minWidth: 150 }}
            onPress={() => router.push('/admin/recipes/new')}
          >
            <Ionicons name="add-circle" size={22} color={COLORS.text.default} />
            <Text preset="body" className="ml-sm font-bold" numberOfLines={1} color={COLORS.text.default}>New Recipe</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-primary-default rounded-lg p-md flex-row items-center"
            style={{ width: '48%', minWidth: 150 }}
            onPress={() => router.push('/admin/ingredients')}
          >
            <Ionicons name="leaf" size={22} color={COLORS.text.default} />
            <Text preset="body" className="ml-sm font-bold" numberOfLines={1} color={COLORS.text.default}>Ingredients</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-primary-default rounded-lg p-md flex-row items-center"
            style={{ width: '48%', minWidth: 150 }}
            onPress={() => router.push('/admin/tags')}
          >
            <Ionicons name="pricetags" size={22} color={COLORS.text.default} />
            <Text preset="body" className="ml-sm font-bold" numberOfLines={1} color={COLORS.text.default}>Tags</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-primary-default rounded-lg p-md flex-row items-center"
            style={{ width: '48%', minWidth: 150 }}
            onPress={() => router.push('/admin/useful-items')}
          >
            <Ionicons name="cube" size={22} color={COLORS.text.default} />
            <Text preset="body" className="ml-sm font-bold" numberOfLines={1} color={COLORS.text.default}>Useful Items</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AdminLayout>
  );
}

