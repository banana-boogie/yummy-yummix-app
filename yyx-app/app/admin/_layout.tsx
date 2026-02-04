import React, { useState } from 'react';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { AdminRoute } from '@/components/admin/AdminRoute';
import { View, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/common/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { useRouter } from 'expo-router';
import { MaxWidthConfig } from '@/components/layouts/PageLayout';
import { useDevice } from '@/hooks/useDevice';

export default function AdminLayout() {
  return (
    <AdminRoute>
      <Head>
        <title>YummyYummix - Admin Panel</title>
      </Head>

      <Stack screenOptions={{
        headerShown: false,
      }}>
        <Stack.Screen
          name="index"
          options={{
            title: 'Admin Dashboard'
          }}
        />
        <Stack.Screen
          name="recipes"
          options={{
            title: 'Manage Recipes'
          }}
        />
        <Stack.Screen
          name="ingredients"
          options={{
            title: 'Manage Ingredients'
          }}
        />
        <Stack.Screen
          name="tags"
          options={{
            title: 'Manage Tags'
          }}
        />
        <Stack.Screen
          name="useful-items"
          options={{
            title: 'Manage Useful Items'
          }}
        />
        <Stack.Screen
          name="analytics"
          options={{
            title: 'Analytics'
          }}
        />
      </Stack>
    </AdminRoute>
  );
}

// Navigation items for admin panel
const navItems = [
  { title: 'Dashboard', icon: 'grid-outline', route: '/admin' as const },
  { title: 'Analytics', icon: 'stats-chart-outline', route: '/admin/analytics' as const },
  { title: 'Recipes', icon: 'restaurant-outline', route: '/admin/recipes' as const },
  { title: 'Ingredients', icon: 'leaf-outline', route: '/admin/ingredients' as const },
  { title: 'Tags', icon: 'pricetags-outline', route: '/admin/tags' as const },
  { title: 'Useful Items', icon: 'cube-outline', route: '/admin/useful-items' as const },
  { title: 'Back to App', icon: 'exit-outline', route: '/' as const },
];

export function AdminHeader({ title, showBackButton = false, maxWidth = 1000 }: {
  title: string;
  showBackButton?: boolean;
  maxWidth?: number | MaxWidthConfig;
}) {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const { isSmall } = useDevice();

  // Convert maxWidth to number if it's an object
  const resolvedMaxWidth = typeof maxWidth === 'object' ?
    maxWidth.largeScreen || maxWidth.mediumScreen || maxWidth.smallScreen || 1000 :
    maxWidth;

  return (
    <SafeAreaView className="bg-primary-default" edges={['top']}>
      <View className="bg-primary-default py-sm">
        <View className="w-full self-center" style={{ maxWidth: resolvedMaxWidth }}>
          <View className="flex-row items-center justify-between px-lg">
            {showBackButton ? (
              <TouchableOpacity
                onPress={() => router.back()}
                className="min-w-[24px]"
              >
                <Ionicons name="arrow-back" size={24} color={COLORS.neutral.WHITE} />
              </TouchableOpacity>
            ) : (
              <View className="min-w-[24px]" />
            )}
            <Text preset="h1" className="flex-1 text-white" align="center">{title}</Text>
            <TouchableOpacity
              className="p-xs min-w-[24px]"
              onPress={() => setMenuVisible(true)}
            >
              <Ionicons name="menu" size={24} color={COLORS.neutral.WHITE} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <View className="bg-white rounded-[10px] w-[80%] max-w-[400px] overflow-hidden">
            <View className="flex-row justify-between items-center p-md border-b border-border-default">
              <Text className="text-lg font-bold text-text-default">Admin Menu</Text>
              <TouchableOpacity onPress={() => setMenuVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text.default} />
              </TouchableOpacity>
            </View>
            <ScrollView className="max-h-[400px]">
              {navItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  className="flex-row items-center p-md border-b border-border-default"
                  onPress={() => {
                    router.push(item.route);
                    setMenuVisible(false);
                  }}
                >
                  <Ionicons name={item.icon as any} size={24} color={COLORS.primary.DARKEST} />
                  <Text className="ml-md text-base text-text-default">{item.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
