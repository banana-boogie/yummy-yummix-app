import React from 'react';
import { Pressable, View, DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  withTiming,
  useAnimatedStyle,
  interpolate,
  useSharedValue
} from 'react-native-reanimated';
import { Text } from '@/components/common/Text';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { COLORS } from '@/constants/design-tokens';

type CheckableUsefulItem = {
  id: string;
  name: string;
  pictureUrl: string;
  checked: boolean;
};

type MiseEnPlaceUsefulItemProps = {
  item: CheckableUsefulItem;
  onPress: () => void;
  width: DimensionValue;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Individual useful item component with checkbox
 * 
 * Design: Consistent with MiseEnPlaceIngredient:
 * - Image with checkbox overlay
 * - Name prominent and centered
 */
export const MiseEnPlaceUsefulItem = React.memo(function MiseEnPlaceUsefulItem({
  item,
  onPress,
  width,
  className = '',
  style
}: MiseEnPlaceUsefulItemProps) {
  const checkmarkOpacity = useSharedValue(item.checked ? 1 : 0);

  const animatedStyles = useAnimatedStyle(() => ({
    opacity: interpolate(checkmarkOpacity.value, [0, 1], [1, 0.5]),
  }));

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newOpacity = item.checked ? 0 : 1;
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
            source={item.pictureUrl}
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
            {item.checked && (
              <Text
                className="text-[22px] font-bold absolute"
                style={{ color: COLORS.primary.dark }}
              >
                ✓
              </Text>
            )}
          </View>
        </View>

        {/* Item name - prominent */}
        <Text
          preset="handwritten"
          className="text-xl text-center"
          fontWeight="600"
        >
          {item.name}
        </Text>
      </Animated.View>
    </Pressable>
  );
});