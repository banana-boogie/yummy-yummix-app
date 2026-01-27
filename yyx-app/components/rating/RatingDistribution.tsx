import React, { useMemo } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common';
import { StarRating } from '@/components/rating/StarRating';
import { useLanguage } from '@/contexts/LanguageContext';
import i18n from '@/i18n';

interface RatingDistributionProps {
    distribution: { [key: number]: number };
    total: number;
    averageRating: number | null;
    className?: string;
    style?: StyleProp<ViewStyle>;
}

/**
 * Displays rating distribution with percentage bars for each star level
 * Shows breakdown like "X% gave 5 stars, Y% gave 4 stars, etc."
 */
export function RatingDistribution({
    distribution,
    total,
    averageRating,
    className = '',
    style,
}: RatingDistributionProps) {
    const { language } = useLanguage();
    const locale = language === 'es' ? 'es-MX' : 'en-US';
    const hasIntl = typeof Intl !== 'undefined' && typeof Intl.NumberFormat === 'function';
    const percentFormatter = useMemo(
        () => (hasIntl ? new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }) : null),
        [hasIntl, locale]
    );
    const ratingFormatter = useMemo(
        () => (hasIntl ? new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : null),
        [hasIntl, locale]
    );

    if (total === 0) {
        return null;
    }

    // Calculate percentages for each star level
    const getPercentage = (count: number): number => {
        if (total === 0) return 0;
        return Math.round((count / total) * 100);
    };

    // Render a single row for a star level
    const renderRow = (stars: number) => {
        const count = distribution[stars] || 0;
        const percentage = getPercentage(count);
        const percentageLabel = percentFormatter
            ? percentFormatter.format(total > 0 ? count / total : 0)
            : `${percentage}%`;

        return (
            <View key={stars} className="flex-row items-center mb-xs">
                {/* Star count label */}
                <Text preset="caption" className="w-[20px] text-text-secondary">
                    {stars}
                </Text>

                {/* Star icon */}
                <Text className="text-status-warning mr-xs">★</Text>

                {/* Progress bar container */}
                <View className="flex-1 h-[8px] bg-grey-light rounded-full overflow-hidden mr-sm">
                    {/* Filled portion */}
                    <View
                        className="h-full bg-status-warning rounded-full"
                        style={{ width: `${percentage}%` }}
                    />
                </View>

                {/* Percentage label */}
                <Text preset="caption" className="w-[36px] text-right text-text-secondary">
                    {percentageLabel}
                </Text>
            </View>
        );
    };

    return (
        <View className={`bg-background-default rounded-lg p-md ${className}`} style={style}>
            {/* Header with average and total */}
            <View className="flex-row items-center mb-md">
                <View className="mr-md">
                    <Text preset="h2" className="text-text-default">
                        {averageRating !== null
                            ? ratingFormatter
                                ? ratingFormatter.format(averageRating)
                                : averageRating.toFixed(1)
                            : '—'
                        }
                    </Text>
                    <StarRating rating={averageRating || 0} size="sm" />
                </View>
                <Text preset="bodySmall" className="text-text-secondary">
                    {total === 1
                        ? i18n.t('recipes.rating.ratingCount', { count: total })
                        : i18n.t('recipes.rating.ratingsCount', { count: total })
                    }
                </Text>
            </View>

            {/* Distribution bars (5 stars at top, 1 at bottom) */}
            <View>
                {[5, 4, 3, 2, 1].map(renderRow)}
            </View>
        </View>
    );
}

export default RatingDistribution;
