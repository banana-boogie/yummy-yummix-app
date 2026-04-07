import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text, SafeImage } from '@/components/common';
import { AdminRecipeIngredient, getTranslatedField } from '@/types/recipe.admin.types';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/i18n';
import { formatIngredientQuantity } from '@/utils/recipes/measurements';
import { useDevice } from '@/hooks/useDevice';

interface AdminRecipeIngredientCardProps {
  recipeIngredient: AdminRecipeIngredient;
  displayLocale?: string;
  hideActions?: boolean;
  onEditPress?: () => void;
  onDeletePress?: () => void;
  onMoveUpPress?: () => void;
  onMoveDownPress?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  /** Optional drag handle element — when provided, replaces up/down arrows on desktop */
  dragHandle?: React.ReactNode;
}

export const AdminRecipeIngredientCard: React.FC<AdminRecipeIngredientCardProps> = ({
  recipeIngredient,
  displayLocale = 'es',
  onEditPress,
  onDeletePress,
  onMoveUpPress,
  onMoveDownPress,
  isFirst = false,
  isLast = false,
  hideActions = false,
  dragHandle,
}) => {
  const { isMobile } = useDevice();
  const ingredientName = getTranslatedField(recipeIngredient.ingredient?.translations, displayLocale, 'name');
  const notes = getTranslatedField(recipeIngredient.translations, displayLocale, 'notes');
  const tip = getTranslatedField(recipeIngredient.translations, displayLocale, 'tip');
  const unitSymbol = getTranslatedField(recipeIngredient.measurementUnit?.translations, displayLocale, 'symbol');
  const formattedQty = formatIngredientQuantity(recipeIngredient.quantity, recipeIngredient.measurementUnit?.id);

  // Desktop: compact single-row card
  if (!isMobile) {
    return (
      <View className="flex-row items-center p-sm border border-border-default rounded-sm mb-sm bg-background-default gap-xs">
        {/* Drag handle (when provided) */}
        {dragHandle ? dragHandle : null}

        {/* Image */}
        <SafeImage
          source={recipeIngredient.ingredient.pictureUrl}
          placeholder="ingredient"
          className="w-8 h-8 rounded-xs"
          contentFit="contain"
        />

        {/* Content: name, quantity, notes inline */}
        <View className="flex-1 min-w-0">
          <View className="flex-row flex-wrap items-baseline gap-xs">
            <Text preset="bodySmall" className="font-semibold">{ingredientName}</Text>
            <Text preset="caption" className="text-text-secondary">
              {formattedQty} {unitSymbol}
            </Text>
            {recipeIngredient.optional ? (
              <Text preset="caption" className="italic text-text-secondary">
                ({i18n.t('recipes.detail.ingredients.optional')})
              </Text>
            ) : null}
            {notes ? (
              <Text preset="caption" className="text-text-secondary italic" numberOfLines={1}>
                — {notes}
              </Text>
            ) : null}
          </View>
          {tip ? (
            <Text preset="caption" className="text-text-secondary italic mt-xxs" numberOfLines={1}>
              Tip: {tip}
            </Text>
          ) : null}
        </View>

        {/* Actions: compact icons */}
        {!hideActions ? (
          <View className="flex-row items-center gap-xxs">
            <TouchableOpacity onPress={onEditPress} className="p-xxs">
              <Ionicons name="pencil" size={14} className="text-primary-dark" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onDeletePress} className="p-xxs">
              <Ionicons name="trash-outline" size={14} className="text-text-secondary" />
            </TouchableOpacity>
            {!dragHandle ? (
              <>
                <TouchableOpacity onPress={() => onMoveUpPress?.()} disabled={isFirst} className={`p-xxs ${isFirst ? 'opacity-30' : ''}`}>
                  <Ionicons name="chevron-up" size={14} className={isFirst ? 'text-grey-medium' : 'text-text-default'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onMoveDownPress?.()} disabled={isLast} className={`p-xxs ${isLast ? 'opacity-30' : ''}`}>
                  <Ionicons name="chevron-down" size={14} className={isLast ? 'text-grey-medium' : 'text-text-default'} />
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }

  // Mobile: keep expanded layout for better touch targets
  return (
    <View className="border border-border-default rounded-md overflow-hidden mb-md bg-background-default p-xs">
      <View className="flex-1">
        {/* Header row - Name and Actions */}
        <View className="flex-col p-xs border-b border-border-default">
          <View className="flex-row items-center flex-1">
            <SafeImage
              source={recipeIngredient.ingredient.pictureUrl}
              placeholder="ingredient"
              className="w-8 h-8 rounded-sm mr-xs"
              contentFit="contain"
            />
            <View className="flex-1">
              <Text className="font-semibold text-base">{ingredientName}</Text>
            </View>
          </View>

          {!hideActions ? (
            <View className="flex-row items-center mt-sm justify-end">
              <TouchableOpacity onPress={onEditPress} className="p-xxs mr-xs rounded-sm border border-primary-light">
                <Ionicons name="pencil" size={16} className="text-primary-default" />
              </TouchableOpacity>
              <TouchableOpacity onPress={onDeletePress} className="p-xxs mr-xs">
                <Ionicons name="trash-outline" size={16} className="text-text-secondary" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onMoveUpPress?.()} disabled={isFirst} className={`p-xxs ${isFirst ? 'opacity-50' : ''}`}>
                <Ionicons name="chevron-up" size={16} className={isFirst ? 'text-text-secondary' : 'text-text-default'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onMoveDownPress?.()} disabled={isLast} className={`p-xxs ${isLast ? 'opacity-50' : ''}`}>
                <Ionicons name="chevron-down" size={16} className="text-text-secondary" />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* Quantity */}
        <View className="p-sm border-b border-border-default">
          <Text preset="bodySmall" className="font-medium mb-xxs">{i18n.t('admin.recipes.form.ingredientsInfo.quantityTitle')}</Text>
          <Text className="font-medium">
            {formattedQty} {unitSymbol}
            {recipeIngredient.optional ? (
              <Text className="text-xs text-text-secondary italic">
                {' '}({i18n.t('recipes.detail.ingredients.optional')})
              </Text>
            ) : null}
          </Text>
        </View>

        <View className="p-sm">
          {notes ? (
            <View className="mb-sm">
              <Text preset="bodySmall" className="font-medium mb-xxs">{i18n.t('admin.recipes.form.ingredientsInfo.notesTitle')}</Text>
              <Text className="text-xs text-text-secondary">{notes}</Text>
            </View>
          ) : null}
          {tip ? (
            <View className="mt-xs">
              <Text preset="bodySmall" className="font-medium mb-xxs">{i18n.t('admin.recipes.form.ingredientsInfo.tipTitle')}</Text>
              <Text className="text-xs text-text-secondary">{tip}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
};

export default AdminRecipeIngredientCard;
