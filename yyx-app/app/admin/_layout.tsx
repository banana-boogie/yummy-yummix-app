import React from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import Head from 'expo-router/head';
import { AdminRoute } from '@/components/admin/AdminRoute';
import { View, TouchableOpacity, Platform, Pressable } from 'react-native';
import { Text } from '@/components/common/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { MaxWidthConfig } from '@/components/layouts/PageLayout';
import { useDevice } from '@/hooks/useDevice';
import i18n from '@/i18n';

// Navigation items — alphabetical, Back to App separate
const navItems = [
  { titleKey: 'admin.common.analytics', icon: 'stats-chart-outline', route: '/admin/analytics' },
  { titleKey: 'admin.common.contentHealth', icon: 'medkit-outline', route: '/admin/content-health' },
  { titleKey: 'admin.common.dashboard', icon: 'grid-outline', route: '/admin' },
  { titleKey: 'admin.common.ingredients', icon: 'leaf-outline', route: '/admin/ingredients' },
  { titleKey: 'admin.common.kitchenTools', icon: 'build-outline', route: '/admin/kitchen-tools' },
  { titleKey: 'admin.common.recipes', icon: 'restaurant-outline', route: '/admin/recipes' },
  { titleKey: 'admin.common.tags', icon: 'pricetag-outline', route: '/admin/tags' },
  { titleKey: 'admin.userRecipes.title', icon: 'people-outline', route: '/admin/user-recipes' },
];

export default function AdminLayout() {
  const { isPhone } = useDevice();
  const isDesktop = Platform.OS === 'web' && !isPhone;
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  return (
    <AdminRoute>
      <Head>
        <title>{i18n.t('admin.common.adminPanelTitle')}</title>
      </Head>

      {isDesktop ? (
        <View className="flex-1 flex-row">
          <AdminSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(prev => !prev)} />
          <View className="flex-1">
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="recipes" />
              <Stack.Screen name="ingredients" />
              <Stack.Screen name="tags" />
              <Stack.Screen name="kitchen-tools" />
              <Stack.Screen name="analytics" />
              <Stack.Screen name="user-recipes" />
              <Stack.Screen name="content-health" />
            </Stack>
          </View>
        </View>
      ) : (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="recipes" />
          <Stack.Screen name="ingredients" />
          <Stack.Screen name="tags" />
          <Stack.Screen name="kitchen-tools" />
          <Stack.Screen name="analytics" />
          <Stack.Screen name="user-recipes" />
          <Stack.Screen name="content-health" />
        </Stack>
      )}
    </AdminRoute>
  );
}

// =============================================================================
// Desktop Sidebar
// =============================================================================

function AdminSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (route: string) => {
    if (route === '/admin') return pathname === '/admin';
    return pathname.startsWith(route);
  };

  return (
    <View
      className="bg-white border-r border-grey-default py-md"
      style={{ width: collapsed ? 56 : 220 }}
    >
      {/* Toggle + title */}
      <View className={`flex-row items-center ${collapsed ? 'justify-center' : 'justify-between px-lg'} mb-lg`}>
        {!collapsed && <Text preset="h3" className="text-text-default">Admin</Text>}
        <Pressable
          onPress={onToggle}
          style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}}
          className="p-xs"
        >
          <Ionicons name={collapsed ? 'play-forward-outline' : 'play-back-outline'} size={16} color={COLORS.text.secondary} />
        </Pressable>
      </View>

      {/* Back to App */}
      <SidebarItem
        icon="home-outline"
        label={i18n.t('admin.common.backToApp', { defaultValue: 'Back to App' })}
        active={false}
        collapsed={collapsed}
        onPress={() => router.push('/')}
      />

      {/* Divider */}
      <View className={`h-[1px] bg-border-default ${collapsed ? 'mx-sm' : 'mx-lg'} mb-sm mt-sm`} />

      {/* Nav items */}
      {navItems.map(item => (
        <SidebarItem
          key={item.route}
          icon={item.icon}
          label={i18n.t(item.titleKey)}
          active={isActive(item.route)}
          collapsed={collapsed}
          onPress={() => router.push(item.route as any)}
        />
      ))}
    </View>
  );
}

function SidebarItem({ icon, label, active, collapsed, onPress }: {
  icon: string;
  label: string;
  active: boolean;
  collapsed: boolean;
  onPress: () => void;
}) {
  const [hovered, setHovered] = React.useState(false);

  const bgColor = active
    ? COLORS.primary.lightest
    : hovered
      ? COLORS.primary.default
      : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      className={`flex-row items-center ${collapsed ? 'justify-center px-sm' : 'gap-sm px-lg'} py-sm`}
      style={[
        { backgroundColor: bgColor },
        Platform.OS === 'web' ? { cursor: 'pointer' } as any : {},
      ]}
    >
      <Ionicons
        name={icon as any}
        size={18}
        color={active ? COLORS.primary.darkest : COLORS.text.secondary}
      />
      {!collapsed && (
        <Text
          preset="bodySmall"
          className={active ? 'text-primary-darkest font-semibold' : 'text-text-secondary'}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// =============================================================================
// AdminHeader — used by AdminLayout component on each page
// =============================================================================

export function AdminHeader({ title, showBackButton = false, maxWidth = 1000 }: {
  title: string;
  showBackButton?: boolean;
  maxWidth?: number | MaxWidthConfig;
}) {
  const router = useRouter();
  const { isPhone } = useDevice();
  const isDesktop = Platform.OS === 'web' && !isPhone;

  const resolvedMaxWidth = typeof maxWidth === 'object' ?
    maxWidth.largeScreen || maxWidth.mediumScreen || maxWidth.smallScreen || 1000 :
    maxWidth;

  // Desktop: no header — sidebar handles navigation
  if (isDesktop) {
    return null;
  }

  // Mobile: peach header with back + hamburger (keep existing mobile pattern)
  return (
    <View className="bg-primary-default py-sm">
      <View className="w-full self-center" style={{ maxWidth: resolvedMaxWidth }}>
        <View className="flex-row items-center justify-between px-lg">
          {showBackButton ? (
            <TouchableOpacity
              onPress={() => router.back()}
              className="min-w-[24px]"
            >
              <Ionicons name="arrow-back" size={24} color={COLORS.neutral.white} />
            </TouchableOpacity>
          ) : (
            <View className="min-w-[24px]" />
          )}
          <Text preset="h1" className="flex-1 text-white" align="center">{title}</Text>
          <View className="min-w-[24px]" />
        </View>
      </View>
    </View>
  );
}
