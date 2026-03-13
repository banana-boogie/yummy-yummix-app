import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/common/Text';
import { AdminRecipeUsefulItem, getTranslatedField } from '@/types/recipe.admin.types';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Divider } from '@/components/common/Divider';
import { useDevice } from '@/hooks/useDevice';

interface AdminRecipeUsefulItemCardProps {
  recipeUsefulItem: AdminRecipeUsefulItem;
  displayLocale?: string;
  onEdit?: (recipeUsefulItem: AdminRecipeUsefulItem) => void;
  onDelete?: (recipeUsefulItem: AdminRecipeUsefulItem) => void;
  onMoveUp?: (recipeUsefulItem: AdminRecipeUsefulItem) => void;
  onMoveDown?: (recipeUsefulItem: AdminRecipeUsefulItem) => void;
  isFirst?: boolean;
  isLast?: boolean;
  hideActions?: boolean;
  variant?: 'editable' | 'readonly';
}

export function AdminRecipeUsefulItemCard({
  recipeUsefulItem,
  displayLocale = 'es',
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst = false,
  isLast = false,
  hideActions = false,
  variant = 'editable'
}: AdminRecipeUsefulItemCardProps) {
  const { isMobile } = useDevice();
  const usefulItemName = getTranslatedField(recipeUsefulItem.usefulItem?.translations, displayLocale, 'name');
  const notes = getTranslatedField(recipeUsefulItem.translations, displayLocale, 'notes');
  const hasNotes = !!notes;
  const isReadonly = variant === 'readonly' || hideActions;

  return (
    <View className={`bg-background-DEFAULT rounded-md border border-border-DEFAULT mb-md shadow-md ${isReadonly ? 'shadow-md' : ''}`}>
      <View className={`flex-row items-center ${isMobile ? 'p-sm' : 'p-md'}`}>
        <View className={`${isMobile ? 'w-[40px] h-[40px]' : 'w-[50px] h-[50px]'} rounded-sm overflow-hidden bg-background-SECONDARY justify-center items-center mr-sm`}>
          {recipeUsefulItem.usefulItem?.pictureUrl ? (
            <Image
              source={recipeUsefulItem.usefulItem.pictureUrl}
              className="w-full h-full"
              contentFit="contain"
              transition={300}
              cachePolicy="memory-disk"
            />
          ) : (
            <View className="w-full h-full justify-center items-center">
              <Ionicons name="image-outline" size={isMobile ? 16 : 20} className="text-text-SECONDARY" />
            </View>
          )}
        </View>

        <View className="flex-1">
          <Text className={`font-semibold ${isMobile ? 'text-sm' : ''}`}>
            {usefulItemName}
          </Text>
        </View>

        {!isReadonly && (
          <View className="flex-row items-center">
            {onMoveUp && !isFirst && (
              <TouchableOpacity
                className="p-xs ml-xxs"
                onPress={() => onMoveUp(recipeUsefulItem)}
                aria-label="Move up"
              >
                <Ionicons name="chevron-up" size={18} className="text-text-SECONDARY" />
              </TouchableOpacity>
            )}

            {onMoveDown && !isLast && (
              <TouchableOpacity
                className="p-xs ml-xxs"
                onPress={() => onMoveDown(recipeUsefulItem)}
                aria-label="Move down"
              >
                <Ionicons name="chevron-down" size={18} className="text-text-SECONDARY" />
              </TouchableOpacity>
            )}

            {onEdit && (
              <TouchableOpacity
                className="p-xs ml-xxs"
                onPress={() => onEdit(recipeUsefulItem)}
                aria-label="Edit"
              >
                <Ionicons name="pencil" size={18} className="text-text-SECONDARY" />
              </TouchableOpacity>
            )}

            {onDelete && (
              <TouchableOpacity
                className="p-xs ml-xxs"
                onPress={() => onDelete(recipeUsefulItem)}
                aria-label="Delete"
              >
                <Ionicons name="trash-outline" size={18} className="text-primary-DEFAULT" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {hasNotes && (
        <View className="px-md pb-sm">
          {variant === 'editable' && (
            <>
              <Text className="text-sm font-bold mb-0">Notes</Text>
              <Divider thickness={0.3} opacity={0.2} />
            </>
          )}
          <Text className="text-xs text-text-SECONDARY mt-xs">{notes}</Text>
        </View>
      )}
    </View>
  );
}
