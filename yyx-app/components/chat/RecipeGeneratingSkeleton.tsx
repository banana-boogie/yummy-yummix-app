/**
 * Recipe Generating Skeleton
 *
 * A shimmer loading skeleton displayed while a custom recipe is being generated.
 * Shows a preview of the card structure to reduce perceived loading time.
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Text } from '@/components/common/Text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

interface RecipeGeneratingSkeletonProps {
    /** Optional message to display while generating */
    statusMessage?: string;
}

/**
 * Animated shimmer effect for skeleton loading
 */
function ShimmerBlock({ width, height, style }: { width: number | string; height: number; style?: object }) {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmerAnim, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [shimmerAnim]);

    const opacity = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <Animated.View
            style={[
                {
                    width,
                    height,
                    backgroundColor: COLORS.grey.light,
                    borderRadius: 4,
                    opacity,
                },
                style,
            ]}
        />
    );
}

export function RecipeGeneratingSkeleton({ statusMessage }: RecipeGeneratingSkeletonProps) {
    return (
        <View
            style={styles.container}
            accessibilityRole="progressbar"
            accessibilityLabel={i18n.t('chat.generating')}
        >
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerRow}>
                    <MaterialCommunityIcons
                        name="chef-hat"
                        size={24}
                        color={COLORS.primary.darkest}
                    />
                    <Text style={styles.headerText}>
                        {i18n.t('chat.customRecipe')}
                    </Text>
                </View>

                {/* Recipe name skeleton */}
                <View style={styles.nameRow}>
                    <ShimmerBlock width="70%" height={24} style={{ marginTop: 8 }} />
                </View>
            </View>

            {/* Info row skeleton */}
            <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                    <MaterialCommunityIcons
                        name="clock-outline"
                        size={18}
                        color={COLORS.grey.medium}
                    />
                    <ShimmerBlock width={40} height={16} style={{ marginLeft: 4 }} />
                </View>
                <View style={styles.infoItem}>
                    <MaterialCommunityIcons
                        name="signal-cellular-2"
                        size={18}
                        color={COLORS.grey.medium}
                    />
                    <ShimmerBlock width={50} height={16} style={{ marginLeft: 4 }} />
                </View>
                <View style={styles.infoItem}>
                    <MaterialCommunityIcons
                        name="account-group-outline"
                        size={18}
                        color={COLORS.grey.medium}
                    />
                    <ShimmerBlock width={20} height={16} style={{ marginLeft: 4 }} />
                </View>
            </View>

            {/* Ingredients skeleton */}
            <View style={styles.ingredientsSection}>
                <ShimmerBlock width={80} height={14} style={{ marginBottom: 8 }} />
                <View style={styles.ingredientChips}>
                    <ShimmerBlock width={100} height={28} style={styles.chip} />
                    <ShimmerBlock width={80} height={28} style={styles.chip} />
                    <ShimmerBlock width={120} height={28} style={styles.chip} />
                    <ShimmerBlock width={90} height={28} style={styles.chip} />
                </View>
            </View>

            {/* Status message */}
            <View style={styles.statusRow}>
                <Text style={styles.statusText}>
                    {statusMessage || i18n.t('chat.generating')}
                </Text>
            </View>

            {/* Button skeleton */}
            <View style={styles.buttonSection}>
                <ShimmerBlock width="100%" height={44} style={{ borderRadius: 8 }} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'white',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border.default,
        overflow: 'hidden',
        marginTop: 8,
    },
    header: {
        backgroundColor: COLORS.primary.lightest,
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border.default,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerText: {
        color: COLORS.primary.darkest,
        fontWeight: '600',
        marginLeft: 8,
    },
    nameRow: {
        marginTop: 4,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 24,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border.default,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ingredientsSection: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border.default,
    },
    ingredientChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        borderRadius: 16,
    },
    statusRow: {
        padding: 16,
        alignItems: 'center',
    },
    statusText: {
        color: COLORS.text.secondary,
        fontSize: 14,
    },
    buttonSection: {
        padding: 16,
        paddingTop: 0,
    },
});
