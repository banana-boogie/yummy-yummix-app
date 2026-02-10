import React from 'react';
import { Pressable, View, DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  withTiming,
  useAnimatedStyle,
  interpolate,
  useSharedValue
} from 'react-native-reanimated';
import { Text } from '@/components/common/Text';
import { RecipeIngredient } from '@/types/recipe.types';
import { getIngredientName } from '@/utils/recipes/ingredients';
import { Image } from 'expo-image';
import { COLORS } from '@/constants/design-tokens';

// Use the same type definition as in the original file
type CheckableIngredient = RecipeIngredient & { checked: boolean };

type MiseEnPlaceIngredientProps = {
  ingredient: CheckableIngredient;
  onPress: () => void;
  width: DimensionValue;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Individual ingredient item component with checkbox
 * 
 * Design: Vertical card layout with:
 * - Ingredient image with checkbox overlay
 * - Name prominent and bold  
 * - Quantity/unit secondary below
 */
export const MiseEnPlaceIngredient = React.memo(function MiseEnPlaceIngredient({
  ingredient,
  onPress,
  width,
  className = '',
  style
}: MiseEnPlaceIngredientProps) {
  const checkmarkOpacity = useSharedValue(ingredient.checked ? 1 : 0);

  const animatedStyles = useAnimatedStyle(() => ({
    opacity: interpolate(checkmarkOpacity.value, [0, 1], [1, 0.5]),
  }));

  const handlePress = () => {
    const newOpacity = ingredient.checked ? 0 : 1;
    checkmarkOpacity.value = withTiming(newOpacity, { duration: 300 });
    onPress();
  };

  return (
    <Pressable
      className={`mb-lg ${className}`}
      style={[{ width }, style]}
      onPress={handlePress}
    >
      <Animated.View className="flex-col items-center" style={animatedStyles}>
        {/* Image with checkbox overlay */}
        <View className="relative mb-sm">
          <Image
            source={ingredient.pictureUrl}
            className="w-[80px] h-[80px]"
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={300}
          />
          {/* Checkbox positioned at bottom-right of image */}
          <View className="absolute -bottom-1 -right-1 w-7 h-7 justify-center items-center bg-background-default rounded-sm">
            <Image
              source={require('@/assets/images/icons/checkbox-unchecked.png')}
              className="w-[22px] h-[22px]"
              contentFit="contain"
              cachePolicy="memory-disk"
            />
            {ingredient.checked && (
              <Text
                className="text-[22px] font-bold absolute"
                style={{ color: COLORS.primary.dark }}
              >
                ✓
              </Text>
            )}
          </View>
        </View>

        {/* Ingredient name - prominent */}
        <Text
          preset="handwritten"
          className="text-xl text-center mb-xxs"
          fontWeight="600"
        >
          {getIngredientName(ingredient)}
        </Text>

        {/* Quantity and unit - secondary */}
        <Text
          preset="handwritten"
          className="text-lg text-center"
          color={COLORS.text.secondary}
        >
          {ingredient.formattedQuantity} {ingredient.formattedUnit}
        </Text>
      </Animated.View>
    </Pressable>
  );
});