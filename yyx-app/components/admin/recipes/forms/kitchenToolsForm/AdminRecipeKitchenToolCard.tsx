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
  const isReadonly = variant === 'readonly' || hideActions;

  // Desktop: compact single-row card matching ingredient cards
  if (!isMobile) {
    return (
      <View className="flex-row items-center p-sm border border-border-default rounded-md mb-sm bg-background-default gap-sm">
        <SafeImage
          source={recipeKitchenTool.kitchenTool?.pictureUrl}
          placeholder="kitchenTool"
          className="w-10 h-10 rounded-sm"
          contentFit="contain"
        />

        <View className="flex-1 min-w-0">
          <View className="flex-row flex-wrap items-baseline gap-xs">
            <Text preset="bodySmall" className="font-semibold">{kitchenToolName}</Text>
            {notes ? (
              <Text preset="caption" className="text-text-secondary italic" numberOfLines={1}>
                — {notes}
              </Text>
            ) : null}
          </View>
        </View>

        {!isReadonly ? (
          <View className="flex-row items-center gap-xxs">
            {onMoveUp && (
              <TouchableOpacity onPress={() => onMoveUp(recipeKitchenTool)} disabled={isFirst} className={`p-xxs ${isFirst ? 'opacity-30' : ''}`}>
                <Ionicons name="chevron-up" size={14} className={isFirst ? 'text-grey-medium' : 'text-text-default'} />
              </TouchableOpacity>
            )}
            {onMoveDown && (
              <TouchableOpacity onPress={() => onMoveDown(recipeKitchenTool)} disabled={isLast} className={`p-xxs ${isLast ? 'opacity-30' : ''}`}>
                <Ionicons name="chevron-down" size={14} className={isLast ? 'text-grey-medium' : 'text-text-default'} />
              </TouchableOpacity>
            )}
            {onEdit && (
              <TouchableOpacity onPress={() => onEdit(recipeKitchenTool)} className="p-xxs">
                <Ionicons name="pencil" size={14} className="text-primary-dark" />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity onPress={() => onDelete(recipeKitchenTool)} className="p-xxs">
                <Ionicons name="trash-outline" size={14} className="text-text-secondary" />
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </View>
    );
  }

  // Mobile: keep expanded layout
  return (
    <View className="bg-background-default rounded-md border border-border-default mb-md">
      <View className="flex-row items-center p-sm">
        <View className="w-[40px] h-[40px] rounded-sm overflow-hidden bg-background-secondary justify-center items-center mr-sm">
          <SafeImage
            source={recipeKitchenTool.kitchenTool?.pictureUrl}
            placeholder="kitchenTool"
            className="w-full h-full"
            contentFit="contain"
          />
        </View>

        <View className="flex-1">
          <Text className="font-semibold text-sm">{kitchenToolName}</Text>
        </View>

        {!isReadonly && (
          <View className="flex-row items-center">
            {onMoveUp && !isFirst && (
              <TouchableOpacity className="p-xs ml-xxs" onPress={() => onMoveUp(recipeKitchenTool)}>
                <Ionicons name="chevron-up" size={18} className="text-text-secondary" />
              </TouchableOpacity>
            )}
            {onMoveDown && !isLast && (
              <TouchableOpacity className="p-xs ml-xxs" onPress={() => onMoveDown(recipeKitchenTool)}>
                <Ionicons name="chevron-down" size={18} className="text-text-secondary" />
              </TouchableOpacity>
            )}
            {onEdit && (
              <TouchableOpacity className="p-xs ml-xxs" onPress={() => onEdit(recipeKitchenTool)}>
                <Ionicons name="pencil" size={18} className="text-text-secondary" />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity className="p-xs ml-xxs" onPress={() => onDelete(recipeKitchenTool)}>
                <Ionicons name="trash-outline" size={18} className="text-primary-default" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {notes ? (
        <View className="px-sm pb-sm">
          {variant === 'editable' && (
            <>
              <Text className="text-sm font-bold mb-0">Notes</Text>
              <Divider thickness={0.3} opacity={0.2} />
            </>
          )}
          <Text className="text-xs text-text-secondary mt-xs">{notes}</Text>
        </View>
      ) : null}
    </View>
  );
}
