import React from 'react';
import { View, Pressable, Dimensions } from 'react-native';
import { Text } from '@/components/common';
import { Ionicons } from '@expo/vector-icons';
import { Cookbook } from '@/types/cookbook.types';
import { getGradientForCookbook } from '@/utils/gradients';
import i18n from '@/i18n';

interface CookbookCardProps {
    cookbook: Cookbook;
    onPress: () => void;
    size?: 'small' | 'medium' | 'large';
}

export const CookbookCard = React.memo(function CookbookCard({
    cookbook,
    onPress,
    size = 'medium',
}: CookbookCardProps) {
    const colors = getGradientForCookbook(cookbook.id);

    // Dimensions based on screen width/columns logic in parent, but we can set fixed aspect ratio
    // For grid, usually handled by parent container width, but let's enforce min height
    const height = size === 'small' ? 120 : size === 'large' ? 200 : 160;

    const recipeCountText = `${cookbook.recipeCount} ${
        cookbook.recipeCount === 1
            ? i18n.t('cookbooks.recipe')
            : i18n.t('cookbooks.recipes')
    }`;

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('cookbooks.a11y.openCookbook', {
                name: cookbook.name,
                count: recipeCountText,
            })}
            className="rounded-lg overflow-hidden shadow-sm active:opacity-80 mb-md flex-1 mx-xs"
            style={{ height, backgroundColor: colors[0] }}
        >
            <View
                className="flex-1 p-md justify-between"
                style={{ backgroundColor: colors[0] }} // Fallback if LinearGradient not installed yet, MVP standard view
            >
                <View className="flex-row justify-between items-start">
                    {cookbook.isDefault && (
                        <View
                            className="bg-white/30 rounded-full p-xs"
                            accessibilityLabel={i18n.t('cookbooks.a11y.favoritesCookbook')}
                        >
                            <Ionicons name="heart" size={16} color="#D83A3A" />
                        </View>
                    )}
                    {!cookbook.isPublic && !cookbook.isDefault && (
                        <View
                            className="bg-black/10 rounded-full p-xs"
                            accessibilityLabel={i18n.t('cookbooks.a11y.privateCookbook')}
                        >
                            <Ionicons name="lock-closed" size={14} color="#333" />
                        </View>
                    )}
                    {cookbook.isPublic && (
                        <View
                            className="bg-white/30 rounded-full p-xs"
                            accessibilityLabel={i18n.t('cookbooks.a11y.publicCookbook')}
                        >
                            <Ionicons name="globe-outline" size={14} color="#333" />
                        </View>
                    )}
                </View>

                <View>
                    <Text
                        preset="subheading"
                        className="text-text-primary mb-xs"
                        numberOfLines={2}
                    >
                        {cookbook.name}
                    </Text>
                    <Text preset="caption" className="text-text-secondary">
                        {recipeCountText}
                    </Text>
                </View>
            </View>
        </Pressable>
    );
}, (prevProps, nextProps) => {
    // Only re-render if cookbook data or size actually changed
    return (
        prevProps.cookbook.id === nextProps.cookbook.id &&
        prevProps.cookbook.updatedAt === nextProps.cookbook.updatedAt &&
        prevProps.cookbook.recipeCount === nextProps.cookbook.recipeCount &&
        prevProps.cookbook.name === nextProps.cookbook.name &&
        prevProps.size === nextProps.size
    );
});
