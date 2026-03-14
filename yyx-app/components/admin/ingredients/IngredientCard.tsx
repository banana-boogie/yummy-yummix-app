import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { AdminIngredient, getTranslatedField } from '@/types/recipe.admin.types';
import { Text } from '@/components/common/Text';
import i18n from '@/i18n';

interface IngredientCardProps {
  ingredient: AdminIngredient;
  displayLocale: string;
  onEdit: (ingredient: AdminIngredient) => void;
  onDelete: (ingredient: AdminIngredient) => void;
}

export function IngredientCard({ ingredient, displayLocale, onEdit, onDelete }: IngredientCardProps) {
  const name = getTranslatedField(ingredient.translations, displayLocale, 'name') || '—';
  const pluralName = getTranslatedField(ingredient.translations, displayLocale, 'pluralName');

  return (
    <View className="bg-white rounded-xl p-md mb-md shadow-lg flex-row items-center gap-md">
      {/* Left side with image */}
      <View className="items-center">
        {ingredient.pictureUrl ? (
          <Image
            source={ingredient.pictureUrl}
            className="w-[80px] h-[80px] rounded-lg"
            contentFit="cover"
            transition={300}
            cachePolicy="memory-disk"
          />
        ) : (
          <View className="w-[80px] h-[80px] rounded-lg bg-background-DARK justify-center items-center">
            <Ionicons name="image-outline" size={30} color={COLORS.grey.MEDIUM} />
          </View>
        )}
      </View>

      {/* Middle section with name */}
      <View className="flex-1 gap-xxs">
        <Text
          preset="subheading"
          className="font-semibold"
        >
          {name}
        </Text>
        {pluralName ? (
          <Text
            preset="body"
            className="text-text-SECONDARY"
          >
            {i18n.t('admin.ingredients.pluralName', { defaultValue: 'Plural' })}: {pluralName}
          </Text>
        ) : null}
      </View>

      {/* Right section with actions */}
      <View className="gap-sm">
        <TouchableOpacity
          className="bg-primary-DARK p-sm rounded-md"
          accessibilityRole="button"
          onPress={() => onEdit(ingredient)}
        >
          <Ionicons name="create-outline" size={20} color={COLORS.neutral.WHITE} />
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-status-ERROR p-sm rounded-md"
          accessibilityRole="button"
          onPress={() => onDelete(ingredient)}
        >
          <Ionicons name="trash-outline" size={20} color={COLORS.neutral.WHITE} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
