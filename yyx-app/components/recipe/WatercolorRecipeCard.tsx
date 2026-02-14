import React from 'react';
import { Pressable, View, StyleProp, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Recipe } from '@/types/recipe.types';
import { RecipeImage } from '@/components/recipe/RecipeImage';
import { Text } from '@/components/common/Text';
import { COLORS, FONT_SIZES } from '@/constants/design-tokens';
import { useDevice } from '@/hooks/useDevice';
import { formatTimeInHoursAndMinutes } from '@/utils/formatters';
import { Ionicons } from '@expo/vector-icons';

interface WatercolorRecipeCardProps {
  recipe: Recipe;
  compact?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export const WatercolorRecipeCard = React.memo(function WatercolorRecipeCard({
  recipe,
  compact = false,
  className = '',
  style,
}: WatercolorRecipeCardProps) {
  const router = useRouter();
  const { isPhone } = useDevice();

  if (!recipe.name) return null;

  const handlePress = async () => {
    await Haptics.selectionAsync();
    router.push(`/(tabs)/recipes/${recipe.id}`);
  };

  const compactWidth = isPhone ? 280 : 320;

  return (
    <View
      className={`${className}`}
      style={[compact ? { width: compactWidth } : undefined, style]}
    >
      <View
        className="bg-white rounded-lg overflow-hidden"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        <Pressable
          className="active:opacity-70"
          onPress={handlePress}
        >
          <RecipeImage
            pictureUrl={recipe.pictureUrl}
            className="w-full"
            aspectRatio={compact ? 4 / 3 : 16 / 9}
            width="100%"
          />

          <View className="px-xxs pt-xxs pb-sm flex-row items-center justify-between">
            <Text
              preset="body"
              className="font-normal flex-1"
              numberOfLines={1}
              style={{ fontSize: FONT_SIZES.lg }}
              marginBottom={0}
            >
              {recipe.name}
            </Text>

            {recipe.totalTime != null && (
              <View className="flex-row items-center gap-xxs ml-sm">
                <Ionicons name="time-outline" size={13} color={COLORS.text.secondary} />
                <Text preset="caption" className="text-text-secondary">
                  {formatTimeInHoursAndMinutes(recipe.totalTime)}
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      </View>
    </View>
  );
});
