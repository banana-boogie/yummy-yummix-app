import React from 'react';
import { View, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { AdminKitchenTool, getTranslatedField } from '@/types/recipe.admin.types';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { Text } from '@/components/common/Text';

interface KitchenToolCardProps {
  kitchenTool: AdminKitchenTool;
  displayLocale: string;
  onPress: (kitchenTool: AdminKitchenTool) => void;
}

export function KitchenToolCard({ kitchenTool, displayLocale, onPress }: KitchenToolCardProps) {
  const name = getTranslatedField(kitchenTool.translations, displayLocale, 'name') || '—';
  const hasImage = !!kitchenTool.pictureUrl && typeof kitchenTool.pictureUrl === 'string';

  return (
    <Pressable
      className="bg-white rounded-lg overflow-hidden"
      style={({ pressed }: any) => [
        {
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          opacity: pressed ? 0.7 : 1,
        },
        Platform.OS === 'web' ? { cursor: 'pointer' } as any : {},
      ]}
      onPress={() => onPress(kitchenTool)}
    >
      {/* Image area */}
      <View className="w-full aspect-square">
        {hasImage ? (
          <Image
            source={{ uri: kitchenTool.pictureUrl }}
            className="w-full h-full"
            contentFit="cover"
          />
        ) : (
          <View className="w-full h-full justify-center items-center bg-grey-light border-2 border-dashed border-grey-medium rounded-t-lg">
            <Ionicons name="camera-outline" size={28} color={COLORS.grey.medium} />
            <Text preset="caption" className="text-text-secondary mt-xs">No image</Text>
          </View>
        )}
      </View>

      {/* Name */}
      <View className="p-sm">
        <Text preset="bodySmall" className="text-text-default text-center" numberOfLines={2}>
          {name}
        </Text>
      </View>
    </Pressable>
  );
}
