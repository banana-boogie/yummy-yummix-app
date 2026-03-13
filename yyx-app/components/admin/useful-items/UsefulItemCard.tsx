import React from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import { AdminUsefulItem, getTranslatedField } from '@/types/recipe.admin.types';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { Text } from '@/components/common/Text';
import { useDevice } from '@/hooks/useDevice';

interface UsefulItemCardProps {
  usefulItem: AdminUsefulItem;
  displayLocale: string;
  onEdit: (usefulItem: AdminUsefulItem) => void;
  onDelete: (usefulItem: AdminUsefulItem) => void;
}

export function UsefulItemCard({ usefulItem, displayLocale, onEdit, onDelete }: UsefulItemCardProps) {
  const { isPhone } = useDevice();
  const name = getTranslatedField(usefulItem.translations, displayLocale, 'name') || '—';

  return (
    <View className="flex-row bg-white rounded-sm mb-md p-md shadow-md items-center">
      {/* Image */}
      <View className={`${isPhone ? 'w-[50px] h-[50px]' : 'w-[60px] h-[60px]'} rounded-xs overflow-hidden mr-md`}>
        {usefulItem.pictureUrl ? (
          <Image
            source={{ uri: usefulItem.pictureUrl }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-full justify-center items-center bg-background-SECONDARY">
            <Ionicons name="image-outline" size={isPhone ? 24 : 40} color={COLORS.grey.MEDIUM} />
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
          onPress={() => onEdit(usefulItem)}
        >
          <Ionicons name="create-outline" size={isPhone ? 20 : 22} color={COLORS.text.default} />
        </TouchableOpacity>

        <TouchableOpacity
          className="p-sm"
          onPress={() => onDelete(usefulItem)}
        >
          <Ionicons name="trash-outline" size={isPhone ? 20 : 22} color={COLORS.status.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
