import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text, SafeImage } from '@/components/common';
import { AdminRecipeKitchenTool, getTranslatedField } from '@/types/recipe.admin.types';
import { Ionicons } from '@expo/vector-icons';
import { Divider } from '@/components/common/Divider';
import { useDevice } from '@/hooks/useDevice';

interface AdminRecipeKitchenToolCardProps {
  recipeKitchenTool: AdminRecipeKitchenTool;
  displayLocale?: string;
  onEdit?: (recipeKitchenTool: AdminRecipeKitchenTool) => void;
  onDelete?: (recipeKitchenTool: AdminRecipeKitchenTool) => void;
  onMoveUp?: (recipeKitchenTool: AdminRecipeKitchenTool) => void;
  onMoveDown?: (recipeKitchenTool: AdminRecipeKitchenTool) => void;
  isFirst?: boolean;
  isLast?: boolean;
  hideActions?: boolean;
  variant?: 'editable' | 'readonly';
}

export function AdminRecipeKitchenToolCard({
  recipeKitchenTool,
  displayLocale = 'es',
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst = false,
  isLast = false,
  hideActions = false,
  variant = 'editable'
}: AdminRecipeKitchenToolCardProps) {
  const { isMobile } = useDevice();
  const kitchenToolName = getTranslatedField(recipeKitchenTool.kitchenTool?.translations, displayLocale, 'name');
  const notes = getTranslatedField(recipeKitchenTool.translations, displayLocale, 'notes');
  const hasNotes = !!notes;
  const isReadonly = variant === 'readonly' || hideActions;

  return (
    <View className={`bg-background-default rounded-md border border-border-default mb-md shadow-md ${isReadonly ? 'shadow-md' : ''}`}>
      <View className={`flex-row items-center ${isMobile ? 'p-sm' : 'p-md'}`}>
        <View className={`${isMobile ? 'w-[40px] h-[40px]' : 'w-[50px] h-[50px]'} rounded-sm overflow-hidden bg-background-secondary justify-center items-center mr-sm`}>
          <SafeImage
            source={recipeKitchenTool.kitchenTool?.pictureUrl}
            placeholder="kitchenTool"
            className="w-full h-full"
            contentFit="contain"
            transition={300}
            cachePolicy="memory-disk"
          />
        </View>

        <View className="flex-1">
          <Text className={`font-semibold ${isMobile ? 'text-sm' : ''}`}>
            {kitchenToolName}
          </Text>
        </View>

        {!isReadonly && (
          <View className="flex-row items-center">
            {onMoveUp && !isFirst && (
              <TouchableOpacity
                className="p-xs ml-xxs"
                onPress={() => onMoveUp(recipeKitchenTool)}
                aria-label="Move up"
              >
                <Ionicons name="chevron-up" size={18} className="text-text-secondary" />
              </TouchableOpacity>
            )}

            {onMoveDown && !isLast && (
              <TouchableOpacity
                className="p-xs ml-xxs"
                onPress={() => onMoveDown(recipeKitchenTool)}
                aria-label="Move down"
              >
                <Ionicons name="chevron-down" size={18} className="text-text-secondary" />
              </TouchableOpacity>
            )}

            {onEdit && (
              <TouchableOpacity
                className="p-xs ml-xxs"
                onPress={() => onEdit(recipeKitchenTool)}
                aria-label="Edit"
              >
                <Ionicons name="pencil" size={18} className="text-text-secondary" />
              </TouchableOpacity>
            )}

            {onDelete && (
              <TouchableOpacity
                className="p-xs ml-xxs"
                onPress={() => onDelete(recipeKitchenTool)}
                aria-label="Delete"
              >
                <Ionicons name="trash-outline" size={18} className="text-primary-default" />
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
          <Text className="text-xs text-text-secondary mt-xs">{notes}</Text>
        </View>
      )}
    </View>
  );
}
