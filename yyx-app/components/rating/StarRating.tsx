import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common';

// Star rating colors matching the app's warm branding
const STAR_COLORS = {
    filled: '#FFA000', // Warm amber (from status.warning)
    empty: '#E0E0E0',  // Light gray
};

interface StarRatingProps {
    rating: number;
    size?: 'sm' | 'md' | 'lg';
    showCount?: boolean;
    count?: number;
    className?: string;
    style?: StyleProp<ViewStyle>;
}

/**
 * Display-only star rating component
 * Shows filled/empty stars based on rating value
 */
export function StarRating({
    rating,
    size = 'md',
    showCount = false,
    count = 0,
    className = '',
    style,
}: StarRatingProps) {
    // Size configurations
    const sizeConfig = {
        sm: { starSize: 12, fontSize: 11, gap: 1 },
        md: { starSize: 16, fontSize: 13, gap: 2 },
        lg: { starSize: 22, fontSize: 16, gap: 3 },
    };

    const config = sizeConfig[size];

    // Clamp rating between 0 and 5
    const clampedRating = Math.max(0, Math.min(5, rating));

    // Round to nearest 0.5 for display
    const displayRating = Math.round(clampedRating * 2) / 2;

    const renderStar = (index: number) => {
        const starValue = index + 1;
        let fillPercentage = 0;

        if (displayRating >= starValue) {
            fillPercentage = 100;
        } else if (displayRating >= starValue - 0.5) {
            fillPercentage = 50;
        }

        return (
            <View
                key={index}
                style={{ marginRight: index < 4 ? config.gap : 0 }}
            >
                <Text
                    style={{
                        fontSize: config.starSize,
                        color: fillPercentage > 0 ? STAR_COLORS.filled : STAR_COLORS.empty,
                    }}
                >
                    {fillPercentage === 100 ? '★' : fillPercentage === 50 ? '★' : '☆'}
                </Text>
                {/* Half star overlay for 50% fill */}
                {fillPercentage === 50 && (
                    <View
                        style={{
                            position: 'absolute',
                            overflow: 'hidden',
                            width: '50%',
                        }}
                    >
                        <Text
                            style={{
                                fontSize: config.starSize,
                                color: STAR_COLORS.filled,
                            }}
                        >
                            ★
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View className={`flex-row items-center ${className}`} style={style}>
            <View className="flex-row items-center">
                {[0, 1, 2, 3, 4].map(renderStar)}
            </View>
            {showCount && count > 0 && (
                <Text
                    preset="caption"
                    style={{ fontSize: config.fontSize, marginLeft: 4 }}
                    className="text-text-secondary"
                >
                    ({count})
                </Text>
            )}
        </View>
    );
}

export default StarRating;
