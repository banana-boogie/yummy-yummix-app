import React from 'react';
import { View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/common';
import { Ionicons } from '@expo/vector-icons';
import { Cookbook } from '@/types/cookbook.types';
import { getGradientForCookbook } from '@/utils/gradients';
import { getRecipeCountText } from '@/utils/formatters';
import { COLORS } from '@/constants/design-tokens';
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
    const height = size === 'small' ? 120 : size === 'large' ? 200 : 160;
    const recipeCountText = getRecipeCountText(cookbook.recipeCount, i18n);
    const hasCoverImage = !!cookbook.coverImageUrl;

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
            {/* Cover image layer */}
            {hasCoverImage && (
                <Image
                    source={{ uri: cookbook.coverImageUrl }}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                    }}
                    contentFit="cover"
                    transition={200}
                />
            )}

            {/* Overlay for readability when image is present */}
            {hasCoverImage && (
                <View
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.3)',
                    }}
                />
            )}

            <View className="flex-1 p-md justify-between">
                <View className="flex-row justify-between items-start">
                    {cookbook.isDefault && (
                        <View
                            className="bg-white/30 rounded-full p-xs"
                            accessibilityLabel={i18n.t('cookbooks.a11y.favoritesCookbook')}
                        >
                            <Ionicons name="heart" size={16} color={hasCoverImage ? '#FFFFFF' : COLORS.primary.darkest} />
                        </View>
                    )}
                    {!cookbook.isPublic && !cookbook.isDefault && (
                        <View
                            className="bg-black/10 rounded-full p-xs"
                            accessibilityLabel={i18n.t('cookbooks.a11y.privateCookbook')}
                        >
                            <Ionicons name="lock-closed" size={14} color={hasCoverImage ? '#FFFFFF' : COLORS.grey.dark} />
                        </View>
                    )}
                    {cookbook.isPublic && (
                        <View
                            className="bg-white/30 rounded-full p-xs"
                            accessibilityLabel={i18n.t('cookbooks.a11y.publicCookbook')}
                        >
                            <Ionicons name="globe-outline" size={14} color={hasCoverImage ? '#FFFFFF' : COLORS.grey.dark} />
                        </View>
                    )}
                </View>

                <View>
                    <Text
                        preset="subheading"
                        className={hasCoverImage ? 'mb-xs' : 'text-text-primary mb-xs'}
                        style={hasCoverImage ? { color: '#FFFFFF' } : undefined}
                        numberOfLines={2}
                    >
                        {cookbook.name}
                    </Text>
                    <Text
                        preset="caption"
                        className={hasCoverImage ? '' : 'text-text-secondary'}
                        style={hasCoverImage ? { color: 'rgba(255,255,255,0.85)' } : undefined}
                    >
                        {recipeCountText}
                    </Text>
                </View>
            </View>
        </Pressable>
    );
});
