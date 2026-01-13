import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { useRouter } from 'expo-router';

interface MobileNavMenuProps {
  iconColor?: string;
}

// Navigation items for admin panel
const navItems = [
  { title: 'Dashboard', icon: 'grid-outline', route: '/admin' as const },
  { title: 'Recipes', icon: 'restaurant-outline', route: '/admin/recipes' as const },
  { title: 'Ingredients', icon: 'leaf-outline', route: '/admin/ingredients' as const },
  { title: 'Back to App', icon: 'exit-outline', route: '/' as const },
];

export const MobileNavMenu: React.FC<MobileNavMenuProps> = ({ iconColor = COLORS.neutral.white }) => {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        className="p-xs"
        onPress={() => setMenuVisible(true)}
      >
        <Ionicons name="menu" size={24} color={iconColor} />
      </TouchableOpacity>

      {/* Mobile Navigation Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <View className="bg-white rounded-[10px] w-[80%] max-w-[400px] overflow-hidden">
            <View className="flex-row justify-between items-center p-md border-b border-border-DEFAULT">
              <Text className="text-lg font-bold text-text-DEFAULT">Admin Menu</Text>
              <TouchableOpacity onPress={() => setMenuVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text.DEFAULT} />
              </TouchableOpacity>
            </View>
            <ScrollView className="max-h-[400px]">
              {navItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  className="flex-row items-center p-md border-b border-border-DEFAULT"
                  onPress={() => {
                    router.push(item.route);
                    setMenuVisible(false);
                  }}
                >
                  <Ionicons name={item.icon as any} size={24} color={COLORS.primary.DARKEST} />
                  <Text className="ml-md text-base text-text-DEFAULT">{item.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};