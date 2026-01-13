import React from 'react';
import { View, Pressable, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common';
import * as Haptics from 'expo-haptics';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withSequence,
} from 'react-native-reanimated';

// Star rating colors matching the app's warm branding
const STAR_COLORS = {
    filled: '#FFA000', // Warm amber
    empty: '#D0D0D0',  // Gray
};

interface StarRatingInputProps {
    value: number;
    onChange: (rating: number) => void;
    disabled?: boolean;
    size?: 'md' | 'lg';
    className?: string;
    style?: StyleProp<ViewStyle>;
}

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
    // Size configurations
    const sizeConfig = {
        md: { starSize: 28, hitSlop: 8, gap: 8 },
        lg: { starSize: 40, hitSlop: 12, gap: 12 },
    };

    const config = sizeConfig[size];

    // Animation values for each star
    const scales = [
        useSharedValue(1),
        useSharedValue(1),
        useSharedValue(1),
        useSharedValue(1),
        useSharedValue(1),
    ];

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

    const renderStar = (index: number) => {
        const starValue = index + 1;
        const isFilled = value >= starValue;

        const animatedStyle = useAnimatedStyle(() => ({
            transform: [{ scale: scales[index].value }],
        }));

        return (
            <Pressable
                key={index}
                onPress={() => handleStarPress(starValue)}
                disabled={disabled}
                hitSlop={config.hitSlop}
                style={{ marginRight: index < 4 ? config.gap : 0 }}
                accessibilityRole="button"
                accessibilityLabel={`Rate ${starValue} star${starValue > 1 ? 's' : ''}`}
                accessibilityState={{ selected: isFilled }}
            >
                <Animated.View style={animatedStyle}>
                    <Text
                        style={{
                            fontSize: config.starSize,
                            color: isFilled ? STAR_COLORS.filled : STAR_COLORS.empty,
                            opacity: disabled ? 0.5 : 1,
                        }}
                    >
                        {isFilled ? '★' : '☆'}
                    </Text>
                </Animated.View>
            </Pressable>
        );
    };

    return (
        <View className={`flex-row items-center justify-center ${className}`} style={style}>
            {[0, 1, 2, 3, 4].map(renderStar)}
        </View>
    );
}

export default StarRatingInput;
