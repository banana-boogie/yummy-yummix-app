import React, { useState, useEffect } from 'react';
import { View, FlatList, ActivityIndicator, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Text } from '@/components/common/Text';
import { COLORS } from '@/constants/design-tokens';
import { supabase } from '@/lib/supabase';
import i18n from '@/i18n';

interface UserRecipeSummary {
  id: string;
  name: string;
  source: string;
  created_at: string;
  user_id: string;
}

export default function UserRecipesPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<UserRecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('user_recipes')
          .select('id, name, source, created_at, user_id')
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;
        setRecipes(data || []);
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <AdminLayout title="User Recipes" showBackButton={true}>
      <View className="px-lg pt-md pb-md bg-white border-b border-border-default">
        <Text preset="caption" className="text-text-secondary">
          {recipes.length} user recipes
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={COLORS.primary.darkest} />
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <Pressable
              className="bg-white rounded-md p-md mb-sm border border-border-default flex-row items-center"
              style={({ pressed }: any) => [
                { opacity: pressed ? 0.7 : 1 },
                Platform.OS === 'web' ? { cursor: 'pointer' } as any : {},
              ]}
              onPress={() => router.push(`/admin/user-recipes/${item.id}`)}
            >
              <View className="flex-1">
                <Text preset="body" className="text-text-default" numberOfLines={1}>
                  {item.name || 'Untitled'}
                </Text>
                <Text preset="caption" className="text-text-secondary">
                  {item.source} · {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="items-center justify-center p-xl">
              <Text preset="body" className="text-text-secondary">No user recipes yet</Text>
            </View>
          }
        />
      )}
    </AdminLayout>
  );
}
