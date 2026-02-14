import React from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useDevice } from '@/hooks/useDevice';
import { useTabBarVisibility } from '@/hooks/useTabBarVisibility';
import { COLORS, LAYOUT, SPACING } from '@/constants/design-tokens';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Tab configuration with proper Ionicons names
const TAB_CONFIG = [
  {
    name: 'recipes',
    icon: 'home',
    iconActive: 'home',
    href: '/recipes',
  },
  {
    name: 'chat',
    icon: 'chatbubble-outline',
    iconActive: 'chatbubble',
    href: '/chat',
  },
  {
    name: 'profile',
    icon: 'person-outline',
    iconActive: 'person',
    href: '/profile',
  },
];

export default function TabLayout() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Redirect href="/auth/signup" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => <PremiumTabBar {...props} />}
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
  );
}

function PremiumTabBar({ state, navigation }: any) {
  const { isLarge, isWeb, isPhone } = useDevice();
  const showTabBar = useTabBarVisibility();
  const insets = useSafeAreaInsets();

  // Don't show tab bar on mobile web or when it should be hidden based on route
  if ((isWeb && isPhone) || !showTabBar) return null;

  if (isLarge) {
    // Sidebar for large screens
    return (
      <View
        className="absolute left-0 top-0 bottom-0 z-[100] items-center"
        style={{
          width: LAYOUT.sidebar.width,
          paddingVertical: Platform.OS === 'web' ? 20 : 32,
          backgroundColor: COLORS.sidebar.background,
          borderRightWidth: 1,
          borderRightColor: COLORS.sidebar.border,
        }}
      >
        <View className="flex-col items-center justify-start gap-lg pt-lg">
          {TAB_CONFIG.map((tab, index) => {
            const isActive = state.index === index;
            const iconName = isActive ? tab.iconActive : tab.icon;

            return (
              <TouchableOpacity
                key={tab.name}
                className="items-center justify-center p-sm"
                onPress={() => navigation.navigate(tab.name)}
                activeOpacity={0.7}
              >
                <View
                  className={`w-12 h-12 rounded-xl items-center justify-center ${isActive ? 'bg-primary-light' : 'bg-transparent'
                    }`}
                >
                  <Ionicons
                    name={iconName as any}
                    size={24}
                    color={isActive ? COLORS.primary.darkest : COLORS.grey.medium}
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  // Premium horizontal tab bar for mobile
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
        {TAB_CONFIG.map((tab, index) => {
          const isActive = state.index === index;
          const iconName = isActive ? tab.iconActive : tab.icon;

          return (
            <TouchableOpacity
              key={tab.name}
              className="items-center justify-center py-xxs"
              onPress={() => navigation.navigate(tab.name)}
              activeOpacity={0.7}
              style={{ minWidth: SPACING.xxl }}
            >
              <View
                className={`rounded-md items-center justify-center ${isActive ? 'bg-primary-light' : 'bg-transparent'
                  }`}
                style={{ width: SPACING['2xl'], height: SPACING['2xl'] }}
              >
                <Ionicons
                  name={iconName as any}
                  size={isActive ? 25 : 23}
                  color={isActive ? COLORS.primary.darkest : COLORS.grey.medium}
                />
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
