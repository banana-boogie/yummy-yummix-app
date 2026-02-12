import React from 'react';
import { View, Pressable, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common';
import * as Haptics from 'expo-haptics';
import Animated, {
    SharedValue,
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withSequence,
} from 'react-native-reanimated';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

// Star rating colors matching the app's warm branding
const STAR_COLORS = {
    filled: COLORS.status.warning, // Warm amber
    empty: COLORS.grey.medium, // Gray
};

interface AnimatedStarProps {
    index: number;
    isFilled: boolean;
    scale: SharedValue<number>;
    starSize: number;
    hitSlop: number;
    gap: number;
    disabled: boolean;
    onPress: () => void;
    accessibilityLabel: string;
}

function AnimatedStar({
    index,
    isFilled,
    scale,
    starSize,
    hitSlop,
    gap,
    disabled,
    onPress,
    accessibilityLabel,
}: AnimatedStarProps) {
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            hitSlop={hitSlop}
            style={{ marginRight: index < 4 ? gap : 0 }}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ selected: isFilled }}
        >
            <Animated.View style={animatedStyle}>
                <Text
                    style={{
                        fontSize: starSize,
                        color: isFilled ? STAR_COLORS.filled : STAR_COLORS.empty,
                        opacity: disabled ? 0.5 : 1,
                    }}
                >
                    {isFilled ? '★' : '☆'}
                </Text>
            </Animated.View>
        </Pressable>
    );
}

interface StarRatingInputProps {
    value: number;
    onChange: (rating: number) => void;
    disabled?: boolean;
    size?: 'md' | 'lg';
    className?: string;
    style?: StyleProp<ViewStyle>;
}

const SIZE_CONFIG = {
    md: { starSize: 28, hitSlop: 8, gap: 8 },
    lg: { starSize: 40, hitSlop: 12, gap: 12 },
};

/**
 * Interactive star rating input component
 * Supports whole stars only (1-5)
 */
export function StarRatingInput({
    value,
    onChange,
    disabled = false,
    size = 'lg',
    className = '',
    style,
}: StarRatingInputProps) {
    const config = SIZE_CONFIG[size];

    // Animation values for each star — called at top level (not in a loop)
    const scale1 = useSharedValue(1);
    const scale2 = useSharedValue(1);
    const scale3 = useSharedValue(1);
    const scale4 = useSharedValue(1);
    const scale5 = useSharedValue(1);
    const scales = [scale1, scale2, scale3, scale4, scale5];

    const handleStarPress = async (starValue: number) => {
        if (disabled) return;

        // Haptic feedback
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Animate the pressed star
        scales[starValue - 1].value = withSequence(
            withSpring(1.3, { damping: 8, stiffness: 400 }),
            withSpring(1, { damping: 8, stiffness: 200 })
        );

        onChange(starValue);
    };

    return (
        <View className={`flex-row items-center justify-center ${className}`} style={style}>
            {scales.map((scale, index) => {
                const starValue = index + 1;
                const isFilled = value >= starValue;
                const accessibilityLabel = starValue === 1
                    ? i18n.t('recipes.rating.rateStar', { count: starValue })
                    : i18n.t('recipes.rating.rateStars', { count: starValue });

                return (
                    <AnimatedStar
                        key={index}
                        index={index}
                        isFilled={isFilled}
                        scale={scale}
                        starSize={config.starSize}
                        hitSlop={config.hitSlop}
                        gap={config.gap}
                        disabled={disabled}
                        onPress={() => handleStarPress(starValue)}
                        accessibilityLabel={accessibilityLabel}
                    />
                );
            })}
        </View>
    );
}

export default StarRatingInput;
