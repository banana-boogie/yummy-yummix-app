/**
 * Recipe card component for displaying recipes in chat.
 * Tapping navigates to the recipe detail/cooking guide.
 */
import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Text } from '@/components/common/Text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RecipeCard } from '@/types/irmixy';
import i18n from '@/i18n';

interface ChatRecipeCardProps {
    recipe: RecipeCard;
}

export function ChatRecipeCard({ recipe }: ChatRecipeCardProps) {
    const handlePress = () => {
        router.push(`/(tabs)/recipes/${recipe.recipeId}`);
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
            className="bg-white rounded-lg overflow-hidden shadow-sm border border-border-default mb-sm"
            activeOpacity={0.7}
        >
            <View className="flex-row">
                {/* Image */}
                {recipe.imageUrl ? (
                    <Image
                        source={{ uri: recipe.imageUrl }}
                        style={{ width: 80, height: 80 }}
                        contentFit="cover"
                    />
                ) : (
                    <View className="w-20 h-20 bg-background-secondary items-center justify-center">
                        <MaterialCommunityIcons name="food" size={32} color="#999" />
                    </View>
                )}

                {/* Content */}
                <View className="flex-1 p-sm justify-center">
                    <Text className="text-text-primary font-semibold text-base" numberOfLines={2}>
                        {recipe.name}
                    </Text>

                    <View className="flex-row items-center mt-xs gap-md">
                        {/* Time */}
                        <View className="flex-row items-center">
                            <MaterialCommunityIcons name="clock-outline" size={14} color="#666" />
                            <Text className="text-text-secondary text-xs ml-xs">
                                {recipe.totalTime} {i18n.t('common.minutesShort')}
                            </Text>
                        </View>

                        {/* Difficulty */}
                        <Text className={`text-xs font-medium ${getDifficultyColor(recipe.difficulty)}`}>
                            {getDifficultyLabel(recipe.difficulty)}
                        </Text>

                        {/* Portions */}
                        <View className="flex-row items-center">
                            <MaterialCommunityIcons name="account-group-outline" size={14} color="#666" />
                            <Text className="text-text-secondary text-xs ml-xs">
                                {recipe.portions}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Arrow */}
                <View className="justify-center pr-sm">
                    <MaterialCommunityIcons name="chevron-right" size={24} color="#ccc" />
                </View>
            </View>
        </TouchableOpacity>
    );
}
