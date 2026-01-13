import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { AdminIngredient } from '@/types/recipe.admin.types';
import { Text } from '@/components/common/Text';

interface IngredientCardProps {
  ingredient: AdminIngredient;
  onEdit: (ingredient: AdminIngredient) => void;
  onDelete: (ingredient: AdminIngredient) => void;
}

export function IngredientCard({ ingredient, onEdit, onDelete }: IngredientCardProps) {
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

      {/* Middle section with names */}
      <View className="flex-1 gap-md">
        <View className="gap-xs">
          <Text
            preset="caption"
            className="text-text-SECONDARY uppercase tracking-widest"
          >
            English
          </Text>
          <View className="gap-xxs">
            <Text
              preset="subheading"
              className="font-semibold mb-xxs"
            >
              {ingredient.nameEn || '—'}
            </Text>
            <Text
              preset="body"
              className="text-text-SECONDARY"
            >
              Plural: {ingredient.pluralNameEn || '—'}
            </Text>
          </View>
        </View>

        <View className="h-[1px] bg-border-default my-xs" />

        <View className="gap-xs">
          <Text
            preset="caption"
            className="text-text-SECONDARY uppercase tracking-widest"
          >
            Spanish
          </Text>
          <View className="gap-xxs">
            <Text
              preset="subheading"
              className="font-semibold mb-xxs"
            >
              {ingredient.nameEs || '—'}
            </Text>
            <Text
              preset="body"
              className="text-text-SECONDARY"
            >
              Plural: {ingredient.pluralNameEs || '—'}
            </Text>
          </View>
        </View>
      </View>

      {/* Right section with actions */}
      <View className="gap-sm">
        <TouchableOpacity
          className="bg-primary-DARK p-sm rounded-md"
          onPress={() => onEdit(ingredient)}
        >
          <Ionicons name="create-outline" size={20} color={COLORS.neutral.WHITE} />
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-status-ERROR p-sm rounded-md"
          onPress={() => onDelete(ingredient)}
        >
          <Ionicons name="trash-outline" size={20} color={COLORS.neutral.WHITE} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
