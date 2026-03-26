/**
 * Recipe card component for displaying recipes in chat.
 * Vertical layout with hero image on top.
 * Tapping navigates to the recipe detail/cooking guide.
 */
import React, { memo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Text, SafeImage } from '@/components/common';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RecipeCard } from '@/types/irmixy';
import i18n from '@/i18n';
import logger from '@/services/logger';
import { COLORS } from '@/constants/design-tokens';
import {
    getChatCustomCookingGuidePath,
    getChatRecipeDetailPath
} from '@/utils/navigation/recipeRoutes';
import { getDifficultyColorClass, getDifficultyLabel } from '@/utils/recipes/difficulty';

const HERO_IMAGE_HEIGHT = 140;

interface ChatRecipeCardProps {
    recipe: RecipeCard;
}

export const ChatRecipeCard = memo(function ChatRecipeCard({ recipe }: ChatRecipeCardProps) {
    const handlePress = () => {
        // Validate recipe ID exists before navigating
        if (!recipe.recipeId) {
            logger.warn('[ChatRecipeCard] Invalid recipeId:', recipe);
            return;
        }

        // Haptic feedback for premium feel
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const isUserRecipe = recipe.recipeTable === 'user_recipes';
        router.push(
            isUserRecipe
                ? getChatCustomCookingGuidePath(recipe.recipeId)
                : getChatRecipeDetailPath(recipe.recipeId)
        );
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            className="bg-white rounded-md overflow-hidden shadow-sm border border-border-default"
            style={{ maxWidth: 280 }}
            activeOpacity={0.7}
        >
            {/* Hero image — only shown when recipe has a photo */}
            {recipe.imageUrl ? (
                <View
                    style={{ width: '100%', height: HERO_IMAGE_HEIGHT, backgroundColor: COLORS.background.secondary }}
                    pointerEvents="none"
                >
                    <SafeImage
                        source={recipe.imageUrl}
                        placeholder="recipe"
                        style={{ width: '100%', height: HERO_IMAGE_HEIGHT }}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        recyclingKey={recipe.recipeId}
                        transition={0}
                    />
                </View>
            ) : null}

            {/* Content */}
            <View className="p-md">
                <Text className="text-text-primary font-semibold text-lg" numberOfLines={2}>
                    {recipe.name}
                </Text>

                <View className="flex-row items-center mt-xs gap-sm">
                    {/* Time */}
                    <View className="flex-row items-center">
                        <MaterialCommunityIcons name="clock-outline" size={16} color={COLORS.grey.medium_dark} />
                        <Text className="text-text-secondary text-sm ml-xs">
                            {recipe.totalTime} {i18n.t('common.minutesShort')}
                        </Text>
                    </View>

                    <Text className="text-text-secondary text-sm">&middot;</Text>

                    {/* Difficulty */}
                    <Text className={`text-sm font-medium ${getDifficultyColorClass(recipe.difficulty)}`}>
                        {getDifficultyLabel(recipe.difficulty)}
                    </Text>

                    <Text className="text-text-secondary text-sm">&middot;</Text>

                    {/* Portions */}
                    <View className="flex-row items-center">
                        <MaterialCommunityIcons name="account-group-outline" size={16} color={COLORS.grey.medium_dark} />
                        <Text className="text-text-secondary text-sm ml-xs">
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
                        size={16}
                        color={COLORS.status.warning}
                        accessibilityElementsHidden={true}
                    />
                    <Text className="text-text-secondary text-sm ml-xs flex-1" numberOfLines={2}>
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
                        size={16}
                        color={COLORS.status.warning}
                        accessibilityElementsHidden={true}
                    />
                    <Text className="text-text-secondary text-sm ml-xs flex-1" numberOfLines={2}>
                        {recipe.allergenWarnings.join(' · ')}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
});
