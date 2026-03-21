import React, { useCallback } from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Tabs, Redirect, usePathname, Link } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { VoiceSessionProvider } from '@/contexts/VoiceSessionContext';
import { CookingSessionProvider } from '@/contexts/CookingSessionContext';
import { useDevice } from '@/hooks/useDevice';
import { useTabBarVisibility } from '@/hooks/useTabBarVisibility';
import { COLORS, LAYOUT, SPACING } from '@/constants/design-tokens';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

type TabConfigItem = {
  name: string;
  href: string;
  icon?: string;
  iconActive?: string;
  image?: ReturnType<typeof require>;
};

const TAB_CONFIG: TabConfigItem[] = [
  { name: 'recipes', icon: 'compass-outline', iconActive: 'compass', href: '/recipes' },
  { name: 'chat', image: require('@/assets/images/irmixy-avatar/irmixy-face.png'), href: '/chat' },
  { name: 'profile', icon: 'person-outline', iconActive: 'person', href: '/profile' },
];

export default function TabLayout() {
  const { user, loading } = useAuth();
  const { isLarge } = useDevice();

  if (loading) return null;
  if (!user) return <Redirect href="/auth/signup" />;

  return (
    <CookingSessionProvider>
    <VoiceSessionProvider>
      <View className="flex-1 flex-row">
        {isLarge && <Sidebar />}
        <Tabs
          initialRouteName="chat"
          screenOptions={{
            headerShown: false,
          }}
          tabBar={(props) => isLarge ? null : <MobileTabBar {...props} />}
        >
          {TAB_CONFIG.map((tab) => (
            <Tabs.Screen
              key={tab.name}
              name={tab.name}
              options={{
                href: tab.href,
              }}
            />
          ))}
        </Tabs>
      </View>
    </VoiceSessionProvider>
    </CookingSessionProvider>
  );
}

/** Vertical sidebar for large screens (tablet landscape, desktop) */
function Sidebar() {
  const pathname = usePathname();

  const renderTabIcon = (tab: TabConfigItem, isActive: boolean, size: number) => {
    if (tab.image) {
      return (
        <Image
          source={tab.image}
          style={{ width: size, height: size, borderRadius: size / 2, opacity: isActive ? 1 : 0.35 }}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      );
    }
    const iconName = isActive ? tab.iconActive : tab.icon;
    return (
      <Ionicons
        name={iconName as any}
        size={size}
        color={isActive ? COLORS.primary.darkest : COLORS.grey.medium}
      />
    );
  };

  return (
    <View
      className="items-center z-10"
      style={{
        width: LAYOUT.sidebar.width,
        paddingVertical: Platform.OS === 'web' ? 20 : 32,
        backgroundColor: COLORS.sidebar.background,
        borderRightWidth: 1,
        borderRightColor: COLORS.sidebar.border,
      }}
    >
      <View className="flex-col items-center justify-start gap-lg pt-lg">
        {TAB_CONFIG.map((tab) => {
          const isActive = pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.name}
              href={tab.href}
              asChild
            >
              <TouchableOpacity
                className="items-center justify-center p-sm"
                activeOpacity={0.7}
              >
                <View
                  className={`w-12 h-12 rounded-xl items-center justify-center ${isActive ? 'bg-primary-light' : 'bg-transparent'
                    }`}
                >
                  {renderTabIcon(tab, isActive, tab.image ? 32 : 24)}
                </View>
              </TouchableOpacity>
            </Link>
          );
        })}
      </View>
    </View>
  );
}

/** Horizontal tab bar for mobile/tablet portrait */
function MobileTabBar({ state, navigation }: BottomTabBarProps) {
  const { isWeb, isPhone } = useDevice();
  const showTabBar = useTabBarVisibility();
  const insets = useSafeAreaInsets();
  const activeRouteName = state.routes[state.index]?.name;

  const renderTabIcon = (tab: TabConfigItem, isActive: boolean, size: number) => {
    if (tab.image) {
      return (
        <Image
          source={tab.image}
          style={{ width: size, height: size, borderRadius: size / 2, opacity: isActive ? 1 : 0.35 }}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      );
    }
    const iconName = isActive ? tab.iconActive : tab.icon;
    return (
      <Ionicons
        name={iconName as any}
        size={size}
        color={isActive ? COLORS.primary.darkest : COLORS.grey.medium}
      />
    );
  };

  const handleTabPress = useCallback((tabName: string, isActive: boolean) => {
    if (isActive) {
      // Do nothing — the screen's own tabPress listener handles scroll-to-top
      return;
    }
    navigation.navigate(tabName);
  }, [navigation]);

  // Don't show tab bar on mobile web or when it should be hidden based on route
  if ((isWeb && isPhone) || !showTabBar) return null;

  return (
    <View
      className="bg-white border-t border-grey-light"
      style={{
        paddingBottom: insets.bottom > 0 ? insets.bottom : SPACING.xs,
        paddingTop: SPACING.sm,
        shadowColor: COLORS.shadow.default,
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: SPACING.xs,
        elevation: SPACING.xs,
      }}
    >
      <View className="flex-row items-center justify-around px-lg">
        {TAB_CONFIG.map((tab) => {
          const isActive = activeRouteName === tab.name;
          const iconSize = tab.image ? (isActive ? 34 : 32) : (isActive ? 26 : 24);

          return (
            <TouchableOpacity
              key={tab.name}
              className="items-center justify-center py-xxs"
              onPress={() => handleTabPress(tab.name, isActive)}
              activeOpacity={0.7}
              style={{ minWidth: SPACING.xxl }}
            >
              <View
                className={`rounded-md items-center justify-center ${isActive ? 'bg-primary-light' : 'bg-transparent'
                  }`}
                style={{ width: SPACING['2xl'], height: SPACING['2xl'] }}
              >
                {renderTabIcon(tab, isActive, iconSize)}
              </View>
              {isActive && (
                <View
                  className="w-xxxs h-xxxs rounded-full bg-primary-darkest mt-xxs"
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
