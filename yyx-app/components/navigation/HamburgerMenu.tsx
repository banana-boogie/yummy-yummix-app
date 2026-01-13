import React, { useState } from 'react';
import { View, TouchableOpacity, Modal, ScrollView, Platform, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/common/Text';
import { COLORS } from '@/constants/design-tokens';
import { SPACING } from '@/constants/design-tokens';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { BORDER_RADIUS, BorderRadius } from '@/constants/design-tokens';
import { FONTS, FONT_SIZES, FONT_WEIGHTS } from '@/constants/design-tokens';

type NavItem = {
  title: string;
  icon: string;
  route: string;
};

const baseNavItems: NavItem[] = [
  { title: 'Recipes', icon: 'restaurant-outline', route: '/(tabs)/recipes' },
  { title: 'Profile', icon: 'person-outline', route: '/(tabs)/profile' },
  { title: 'Settings', icon: 'settings-outline', route: '/settings' },
];

type HamburgerMenuProps = {
  className?: string;
  style?: ViewStyle;
};

export function HamburgerMenu({ className = '', style }: HamburgerMenuProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const router = useRouter();
  const { isAdmin } = useUserProfile();

  const navItems = [...baseNavItems];
  if (isAdmin) {
    navItems.push({ title: 'Admin Panel', icon: 'shield-checkmark', route: '/admin' });
  }

  const handleNavigation = (route: string) => {
    router.push(route as any);
    setMenuVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        className={`bg-white rounded-md mr-xxs ${className}`}
        style={style}
        onPress={() => setMenuVisible(true)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="menu" size={42} />
      </TouchableOpacity>

      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Menu</Text>
              <TouchableOpacity
                onPress={() => setMenuVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={32} color={COLORS.text.default} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalMenu}>
              {navItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.modalNavItem}
                  onPress={() => handleNavigation(item.route)}
                >
                  <Ionicons name={item.icon as any} size={28} color={COLORS.primary.DARK} />
                  <Text style={styles.modalNavText}>{item.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = {
  menuButton: {
    marginRight: SPACING.xxs,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: BORDER_RADIUS.md,

  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  modalContent: {
    backgroundColor: COLORS.neutral.WHITE,
    borderRadius: BORDER_RADIUS.md,
    width: 340,
    maxWidth: 400,
    overflow: 'hidden' as const,
    ...Platform.select({
      web: {
        maxHeight: 600,
      },
      default: {
        maxHeight: 600,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    padding: SPACING.lg,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold' as const,
    color: COLORS.text.default,
  },
  modalMenu: {
    padding: SPACING.md,
  },
  modalNavItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: SPACING.lg,
    borderBottomWidth: 1,
  },
  modalNavText: {
    marginLeft: SPACING.lg,
    fontSize: FONT_SIZES.lg,
    color: COLORS.text.default,
  },
}; 