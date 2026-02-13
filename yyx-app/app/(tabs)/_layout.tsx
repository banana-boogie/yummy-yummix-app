import React from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useDevice } from '@/hooks/useDevice';
import { useTabBarVisibility } from '@/hooks/useTabBarVisibility';
import { COLORS, LAYOUT } from '@/constants/design-tokens';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TabConfigItem = {
  name: string;
  href: string;
  icon?: string;
  iconActive?: string;
  image?: ReturnType<typeof require>;
};

const TAB_CONFIG: TabConfigItem[] = [
  { name: 'recipes', icon: 'sparkles-outline', iconActive: 'sparkles', href: '/recipes' },
  { name: 'chat', image: require('@/assets/images/irmixy-avatar/irmixy-face.png'), href: '/chat' },
  { name: 'profile', icon: 'person-outline', iconActive: 'person', href: '/profile' },
];

export default function TabLayout() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Redirect href="/auth/signup" />;

  return (
    <Tabs
      initialRouteName="chat"
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
          {TAB_CONFIG.map((tab) => {
            const isActive = activeRouteName === tab.name;

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
                  {renderTabIcon(tab, isActive, tab.image ? 32 : 24)}
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
        paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
        paddingTop: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 8,
      }}
    >
      <View className="flex-row items-center justify-around px-lg">
        {TAB_CONFIG.map((tab) => {
          const isActive = activeRouteName === tab.name;
          const iconSize = tab.image ? (isActive ? 34 : 32) : (isActive ? 26 : 24);

          return (
            <TouchableOpacity
              key={tab.name}
              className="items-center justify-center py-xs"
              onPress={() => navigation.navigate(tab.name)}
              activeOpacity={0.7}
              style={{ minWidth: 64 }}
            >
              <View
                className={`w-12 h-12 rounded-2xl items-center justify-center ${isActive ? 'bg-primary-light' : 'bg-transparent'
                  }`}
              >
                {renderTabIcon(tab, isActive, iconSize)}
              </View>
              {isActive && (
                <View
                  className="w-1 h-1 rounded-full bg-primary-darkest mt-xs"
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
