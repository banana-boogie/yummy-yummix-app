import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/common/Text';
import { AdminRecipeIngredient, getTranslatedField } from '@/types/recipe.admin.types';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/i18n';
import { LanguageBadge } from '@/components/common/LanguageBadge';
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
  hideActions = false
}) => {
  const { isMobile } = useDevice();
  const ingredientName = getTranslatedField(recipeIngredient.ingredient?.translations, displayLocale, 'name');
  const notes = getTranslatedField(recipeIngredient.translations, displayLocale, 'notes');
  const tip = getTranslatedField(recipeIngredient.translations, displayLocale, 'tip');

  return (
    <View className={`border border-border-DEFAULT rounded-md overflow-hidden mb-md bg-background-DEFAULT ${isMobile ? 'p-xs' : 'p-sm'}`}>
      <View className="flex-1">
        {/* Header row - Name and Actions */}
        <View className={`${isMobile ? 'flex-col' : 'flex-row items-center'} ${isMobile ? 'p-xs' : 'p-sm'} border-b border-border-DEFAULT`}>
          {/* Ingredient info */}
          <View className="flex-row items-center flex-1">
            <Image
              source={recipeIngredient.ingredient.pictureUrl}
              className={isMobile ? 'w-8 h-8 rounded-sm mr-xs' : 'w-10 h-10 rounded-sm mr-sm'}
              contentFit="contain"
            />
            <View className="flex-1">
              <View className="flex-row items-center gap-xs">
                <LanguageBadge language={displayLocale.toUpperCase()} size="small" />
                <Text className={`font-semibold ${isMobile ? 'text-base' : 'text-lg'}`}>{ingredientName}</Text>
              </View>
            </View>
          </View>

          {/* Actions - horizontal on all screens but more compact on mobile */}
          {!hideActions ? (
            <View className={`flex-row items-center ${isMobile ? 'mt-sm justify-end' : ''}`}>
              <TouchableOpacity
                onPress={onEditPress}
                className={`${isMobile ? 'p-xxs mr-xs' : 'p-xs mr-xs'} rounded-sm border border-primary-LIGHT`}
              >
                <Ionicons name="pencil" size={isMobile ? 16 : 20} className="text-primary-DEFAULT" />
              </TouchableOpacity>
              <TouchableOpacity onPress={onDeletePress} className={`${isMobile ? 'p-xxs mr-xs' : 'p-xs mr-xs'}`}>
                <Ionicons name="trash" size={isMobile ? 16 : 20} className="text-status-ERROR" />
              </TouchableOpacity>
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={() => onMoveUpPress?.()}
                  disabled={isFirst}
                  className={`${isMobile ? 'p-xxs' : 'p-xs'} ${isFirst ? 'opacity-50' : ''}`}
                >
                  <Ionicons
                    name="chevron-up"
                    size={isMobile ? 16 : 20}
                    className={isFirst ? 'text-text-SECONDARY' : 'text-text-DEFAULT'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onMoveDownPress?.()}
                  disabled={isLast}
                  className={`${isMobile ? 'p-xxs' : 'p-xs'} ${isLast ? 'opacity-50' : ''}`}
                >
                  <Ionicons
                    name="chevron-down"
                    size={isMobile ? 16 : 20}
                    className="text-text-SECONDARY"
                  />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>

        {/* Quantity & Measurement */}
        <View className="p-sm border-b border-border-DEFAULT">
          <Text preset="subheading" className="mb-sm">{i18n.t('admin.recipes.form.ingredientsInfo.quantityTitle')}</Text>
          <View className="flex-row items-center">
            <Text className="font-medium">
              {formatIngredientQuantity(recipeIngredient.quantity, recipeIngredient.measurementUnit?.id)} {getTranslatedField(recipeIngredient.measurementUnit?.translations, displayLocale, 'symbol')}
              {recipeIngredient.optional ? (
                <Text className="text-xs text-text-SECONDARY italic">
                  {' '}({i18n.t('recipes.detail.ingredients.optional')})
                </Text>
              ) : null}
            </Text>
          </View>
        </View>

        <View className="p-sm">
          {/* Notes */}
          {notes ? (
            <View className="mb-sm">
              <Text preset="subheading" className="mb-sm">
                {i18n.t('admin.recipes.form.ingredientsInfo.notesTitle')}
              </Text>
              <Text className="flex-1 text-xs text-text-SECONDARY">
                {notes}
              </Text>
            </View>
          ) : null}

          {/* Tips */}
          {tip ? (
            <View className="mt-xs">
              <Text preset="subheading" className="mb-sm">
                {i18n.t('admin.recipes.form.ingredientsInfo.tipTitle')}
              </Text>
              <Text className="flex-1 text-xs text-text-SECONDARY">
                {tip}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
};

export default AdminRecipeIngredientCard;