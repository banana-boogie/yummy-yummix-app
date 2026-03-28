import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { AdminKitchenTool, getTranslatedField } from '@/types/recipe.admin.types';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { Text } from '@/components/common/Text';
import { useDevice } from '@/hooks/useDevice';

interface KitchenToolCardProps {
  kitchenTool: AdminKitchenTool;
  displayLocale: string;
  onEdit: (kitchenTool: AdminKitchenTool) => void;
  onDelete: (kitchenTool: AdminKitchenTool) => void;
}

export function KitchenToolCard({ kitchenTool, displayLocale, onEdit, onDelete }: KitchenToolCardProps) {
  const { isPhone } = useDevice();
  const name = getTranslatedField(kitchenTool.translations, displayLocale, 'name') || '—';

  return (
    <View className="flex-row bg-white rounded-sm mb-md p-md shadow-md items-center">
      {/* Image */}
      <View className={`${isPhone ? 'w-[50px] h-[50px]' : 'w-[60px] h-[60px]'} rounded-xs overflow-hidden mr-md`}>
        {kitchenTool.pictureUrl ? (
          <Image
            source={{ uri: kitchenTool.pictureUrl }}
            className="w-full h-full"
            contentFit="cover"
          />
        ) : (
          <View className="w-full h-full justify-center items-center bg-background-secondary">
            <Ionicons name="image-outline" size={isPhone ? 24 : 40} color={COLORS.grey.medium} />
          </View>
        )}
      </View>

      {/* Name */}
      <View className="flex-1 justify-center mr-sm">
        <Text preset="body" numberOfLines={1}>{name}</Text>
      </View>

      {/* Actions */}
      <View className="flex-row items-center gap-xs">
        <TouchableOpacity
          className="p-sm"
          accessibilityRole="button"
          onPress={() => onEdit(kitchenTool)}
        >
          <Ionicons name="create-outline" size={isPhone ? 20 : 22} color={COLORS.text.default} />
        </TouchableOpacity>

        <TouchableOpacity
          className="p-sm"
          accessibilityRole="button"
          onPress={() => onDelete(kitchenTool)}
        >
          <Ionicons name="trash-outline" size={isPhone ? 20 : 22} color={COLORS.status.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
