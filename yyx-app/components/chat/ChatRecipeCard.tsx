/**
 * Recipe card component for displaying recipes in chat.
 * Vertical layout with hero image on top.
 * Tapping navigates to the recipe detail/cooking guide.
 */
import React, { memo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Text } from '@/components/common/Text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RecipeCard } from '@/types/irmixy';
import i18n from '@/i18n';
import { COLORS } from '@/constants/design-tokens';
import { getChatRecipeDetailPath } from '@/utils/navigation/recipeRoutes';

const HERO_IMAGE_HEIGHT = 140;

interface ChatRecipeCardProps {
    recipe: RecipeCard;
}

export const ChatRecipeCard = memo(function ChatRecipeCard({ recipe }: ChatRecipeCardProps) {
    const handlePress = () => {
        // Validate recipe ID exists before navigating
        if (!recipe.recipeId) {
            console.warn('[ChatRecipeCard] Invalid recipeId:', recipe);
            return;
        }

        // Haptic feedback for premium feel
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(getChatRecipeDetailPath(recipe.recipeId));
    };

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case 'easy': return 'text-status-success';
            case 'medium': return 'text-yellow-600';
            case 'hard': return 'text-status-error';
            default: return 'text-text-secondary';
        }
    };

    const getDifficultyLabel = (difficulty: string) => {
        return i18n.t(`recipes.common.difficulty.${difficulty}`);
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            className="bg-white rounded-md overflow-hidden shadow-sm border border-border-default"
            style={{ maxWidth: 280 }}
            activeOpacity={0.7}
        >
            {/* Hero image */}
            {recipe.imageUrl ? (
                <View
                    style={{ width: '100%', height: HERO_IMAGE_HEIGHT, backgroundColor: COLORS.background.secondary }}
                    pointerEvents="none"
                >
                    <Image
                        source={{ uri: recipe.imageUrl }}
                        style={{ width: '100%', height: HERO_IMAGE_HEIGHT }}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        recyclingKey={recipe.recipeId}
                        transition={0}
                        placeholder={null}
                    />
                </View>
            ) : (
                <View
                    style={{ height: HERO_IMAGE_HEIGHT }}
                    className="w-full bg-background-secondary items-center justify-center"
                    pointerEvents="none"
                >
                    <MaterialCommunityIcons name="food" size={40} color={COLORS.grey.medium} />
                </View>
            )}

            {/* Content */}
            <View className="p-md">
                <Text className="text-text-primary font-semibold text-base" numberOfLines={2}>
                    {recipe.name}
                </Text>

                <View className="flex-row items-center mt-xs gap-sm">
                    {/* Time */}
                    <View className="flex-row items-center">
                        <MaterialCommunityIcons name="clock-outline" size={14} color={COLORS.grey.medium_dark} />
                        <Text className="text-text-secondary text-xs ml-xs">
                            {recipe.totalTime} {i18n.t('common.minutesShort')}
                        </Text>
                    </View>

                    <Text className="text-text-secondary text-xs">&middot;</Text>

                    {/* Difficulty */}
                    <Text className={`text-xs font-medium ${getDifficultyColor(recipe.difficulty)}`}>
                        {getDifficultyLabel(recipe.difficulty)}
                    </Text>

                    <Text className="text-text-secondary text-xs">&middot;</Text>

                    {/* Portions */}
                    <View className="flex-row items-center">
                        <MaterialCommunityIcons name="account-group-outline" size={14} color={COLORS.grey.medium_dark} />
                        <Text className="text-text-secondary text-xs ml-xs">
                            {recipe.portions}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Allergen warnings */}
            {recipe.allergenVerificationWarning && (
                <View
                    className="flex-row items-center px-md py-xs bg-status-warning/10 border-t border-border-default"
                    accessible={true}
                    accessibilityRole="alert"
                    accessibilityLabel={recipe.allergenVerificationWarning}
                >
                    <MaterialCommunityIcons
                        name="alert-outline"
                        size={14}
                        color={COLORS.status.warning}
                        accessibilityElementsHidden={true}
                    />
                    <Text className="text-text-secondary text-xs ml-xs flex-1" numberOfLines={2}>
                        {recipe.allergenVerificationWarning}
                    </Text>
                </View>
            )}
            {recipe.allergenWarnings && recipe.allergenWarnings.length > 0 && (
                <View
                    className="flex-row items-center px-md py-xs bg-status-warning/10 border-t border-border-default"
                    accessible={true}
                    accessibilityRole="alert"
                    accessibilityLabel={recipe.allergenWarnings.join(', ')}
                >
                    <MaterialCommunityIcons
                        name="alert-outline"
                        size={14}
                        color={COLORS.status.warning}
                        accessibilityElementsHidden={true}
                    />
                    <Text className="text-text-secondary text-xs ml-xs flex-1" numberOfLines={2}>
                        {recipe.allergenWarnings.join(' · ')}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
});
