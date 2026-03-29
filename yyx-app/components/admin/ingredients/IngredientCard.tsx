import React, { useState } from 'react';
import { View, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { AdminIngredient, getTranslatedField } from '@/types/recipe.admin.types';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { Text } from '@/components/common/Text';

interface IngredientCardProps {
  ingredient: AdminIngredient;
  displayLocale: string;
  onPress: (ingredient: AdminIngredient) => void;
}

function hasValidImage(url: unknown): url is string {
  return typeof url === 'string' && url.length > 0 && url.startsWith('http');
}

function NoImagePlaceholder() {
  return (
    <View className="w-full h-full justify-center items-center bg-grey-light border-2 border-dashed border-grey-medium">
      <Ionicons name="camera-outline" size={28} color={COLORS.grey.medium} />
      <Text preset="caption" className="text-text-secondary mt-xs">No image</Text>
    </View>
  );
}

export function IngredientCard({ ingredient, displayLocale, onPress }: IngredientCardProps) {
  const name = getTranslatedField(ingredient.translations, displayLocale, 'name') || '\u2014';
  const [imageError, setImageError] = useState(false);
  const showImage = hasValidImage(ingredient.pictureUrl) && !imageError;

  return (
    <Pressable
      className="bg-white rounded-lg overflow-hidden border border-border-default"
      style={({ pressed }: any) => [
        { opacity: pressed ? 0.7 : 1 },
        Platform.OS === 'web' ? { cursor: 'pointer' } as any : {},
      ]}
      onPress={() => onPress(ingredient)}
    >
      {/* Image area */}
      <View className="w-full aspect-square">
        {showImage ? (
          <Image
            source={{ uri: ingredient.pictureUrl as string }}
            className="w-full h-full"
            contentFit="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <NoImagePlaceholder />
        )}
      </View>

      {/* Name */}
      <View className="px-sm py-md border-t border-border-default">
        <Text preset="bodySmall" className="text-text-default text-center" numberOfLines={2}>
          {name}
        </Text>
      </View>
    </Pressable>
  );
}
