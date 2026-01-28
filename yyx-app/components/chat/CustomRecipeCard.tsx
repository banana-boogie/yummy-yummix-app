/**
 * Custom Recipe Card
 *
 * Displays an AI-generated recipe with editable name and "Start Cooking" button.
 * Used in chat when the AI generates a custom recipe from user's ingredients.
 */
import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import type { GeneratedRecipe, SafetyFlags } from '@/types/irmixy';
import i18n from '@/i18n';
import { COLORS } from '@/constants/design-tokens';
import { PLACEHOLDER_IMAGES } from '@/constants/placeholders';

interface CustomRecipeCardProps {
    recipe: GeneratedRecipe;
    safetyFlags?: SafetyFlags;
    onStartCooking: (recipe: GeneratedRecipe, finalName: string) => Promise<void>;
    loading?: boolean;
}

export function CustomRecipeCard({
    recipe,
    safetyFlags,
    onStartCooking,
    loading = false,
}: CustomRecipeCardProps) {
    const [recipeName, setRecipeName] = useState(recipe.suggestedName);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleStartCooking = useCallback(async () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsSaving(true);
        try {
            await onStartCooking(recipe, recipeName);
        } finally {
            setIsSaving(false);
        }
    }, [onStartCooking, recipe, recipeName]);

    const handleEditPress = useCallback(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsEditing(true);
    }, []);

    const handleEditComplete = useCallback(() => {
        setIsEditing(false);
        // Ensure name is not empty
        if (!recipeName.trim()) {
            setRecipeName(recipe.suggestedName);
        }
    }, [recipe.suggestedName, recipeName]);

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case 'easy': return COLORS.status.success;
            case 'medium': return '#ca8a04'; // yellow-600
            case 'hard': return COLORS.status.error;
            default: return COLORS.grey.medium;
        }
    };

    const getDifficultyLabel = (difficulty: string) => {
        return i18n.t(`recipes.common.difficulty.${difficulty}`);
    };

    // Show first 5 ingredients
    const displayIngredients = recipe.ingredients.slice(0, 5);
    const moreCount = recipe.ingredients.length - 5;

    // Check for errors in safety flags
    const hasError = safetyFlags?.error === true;

    if (hasError) {
        return (
            <View className="bg-status-error/10 border border-status-error rounded-lg p-md mt-sm">
                <View className="flex-row items-center mb-sm">
                    <MaterialCommunityIcons name="alert-circle" size={24} color={COLORS.status.error} />
                    <Text className="text-status-error font-semibold ml-sm">
                        {i18n.t('chat.recipeError')}
                    </Text>
                </View>
                <Text className="text-text-secondary">
                    {safetyFlags?.allergenWarning || safetyFlags?.dietaryConflict}
                </Text>
            </View>
        );
    }

    return (
        <View
            className="bg-white rounded-xl shadow-sm border border-border-default overflow-hidden mt-sm"
            accessible={true}
            accessibilityRole="article"
            accessibilityLabel={`${i18n.t('chat.customRecipe')}: ${recipeName}. ${recipe.totalTime} ${i18n.t('common.minutesShort')}, ${getDifficultyLabel(recipe.difficulty)}, ${recipe.portions} ${i18n.t('recipes.common.servings')}`}
        >
            {/* Header with recipe name */}
            <View className="bg-primary-lightest p-md border-b border-border-default">
                <View className="flex-row items-center" pointerEvents="box-none">
                    <MaterialCommunityIcons
                        name="chef-hat"
                        size={24}
                        color={COLORS.primary.darkest}
                        accessibilityElementsHidden={true}
                    />
                    <Text className="text-primary-darkest font-semibold ml-sm flex-1">
                        {i18n.t('chat.customRecipe')}
                    </Text>
                </View>

                {/* Editable recipe name */}
                <TouchableOpacity
                    onPress={handleEditPress}
                    className="mt-sm flex-row items-center"
                    disabled={isEditing}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={isEditing
                        ? i18n.t('chat.editRecipeName')
                        : `${recipeName}. ${i18n.t('chat.editRecipeName')}`}
                    accessibilityHint={i18n.t('chat.editRecipeName')}
                >
                    {isEditing ? (
                        <TextInput
                            value={recipeName}
                            onChangeText={setRecipeName}
                            onBlur={handleEditComplete}
                            onSubmitEditing={handleEditComplete}
                            autoFocus
                            className="flex-1 text-lg font-semibold text-text-primary border-b border-primary-default py-xs"
                            maxLength={100}
                            accessible={true}
                            accessibilityLabel={i18n.t('chat.editRecipeName')}
                            accessibilityHint={i18n.t('chat.editRecipeNameHint')}
                        />
                    ) : (
                        <>
                            <Text className="flex-1 text-lg font-semibold text-text-primary">
                                {recipeName}
                            </Text>
                            <MaterialCommunityIcons
                                name="pencil"
                                size={18}
                                color={COLORS.grey.medium}
                                accessibilityElementsHidden={true}
                            />
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* Recipe info row */}
            <View className="flex-row items-center p-md gap-lg border-b border-border-default">
                {/* Time */}
                <View className="flex-row items-center">
                    <MaterialCommunityIcons
                        name="clock-outline"
                        size={18}
                        color={COLORS.grey.medium_dark}
                    />
                    <Text className="text-text-secondary ml-xs">
                        {recipe.totalTime} {i18n.t('common.minutesShort')}
                    </Text>
                </View>

                {/* Difficulty */}
                <View className="flex-row items-center">
                    <MaterialCommunityIcons
                        name="signal-cellular-2"
                        size={18}
                        color={getDifficultyColor(recipe.difficulty)}
                    />
                    <Text
                        className="ml-xs font-medium"
                        style={{ color: getDifficultyColor(recipe.difficulty) }}
                    >
                        {getDifficultyLabel(recipe.difficulty)}
                    </Text>
                </View>

                {/* Portions */}
                <View className="flex-row items-center">
                    <MaterialCommunityIcons
                        name="account-group-outline"
                        size={18}
                        color={COLORS.grey.medium_dark}
                    />
                    <Text className="text-text-secondary ml-xs">
                        {recipe.portions}
                    </Text>
                </View>
            </View>

            {/* Ingredient preview */}
            <View
                className="p-md border-b border-border-default"
                accessible={true}
                accessibilityRole="list"
                accessibilityLabel={`${i18n.t('recipes.common.ingredients')}: ${displayIngredients.map(ing => `${ing.quantity} ${ing.unit} ${ing.name}`).join(', ')}${moreCount > 0 ? ` ${i18n.t('chat.andMore', { count: moreCount })}` : ''}`}
            >
                <Text className="text-text-secondary text-sm mb-sm">
                    {i18n.t('recipes.common.ingredients')}:
                </Text>
                <View className="flex-row flex-wrap gap-md">
                    {displayIngredients.map((ingredient, index) => (
                        <View
                            key={index}
                            className="flex-col items-center gap-xs"
                            accessibilityElementsHidden={true}
                        >
                            <Image
                                source={ingredient.imageUrl ? { uri: ingredient.imageUrl } : PLACEHOLDER_IMAGES.ingredient}
                                className="w-12 h-12 rounded-full bg-background-tertiary"
                                contentFit="cover"
                            />
                            <View className="bg-background-secondary px-sm py-xs rounded-full">
                                <Text className="text-text-primary text-sm">
                                    {ingredient.quantity} {ingredient.unit} {ingredient.name}
                                </Text>
                            </View>
                        </View>
                    ))}
                    {moreCount > 0 && (
                        <View
                            className="bg-background-secondary px-sm py-xs rounded-full"
                            accessibilityElementsHidden={true}
                        >
                            <Text className="text-text-secondary text-sm">
                                +{moreCount} {i18n.t('common.more')}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Safety warning if present */}
            {safetyFlags?.allergenWarning && !safetyFlags.error && (
                <View
                    className="flex-row items-center p-md bg-status-warning/10 border-b border-border-default"
                    accessible={true}
                    accessibilityRole="alert"
                    accessibilityLabel={`${i18n.t('chat.warningPrefix')}: ${safetyFlags.allergenWarning}`}
                >
                    <MaterialCommunityIcons
                        name="alert-outline"
                        size={20}
                        color={COLORS.status.warning}
                        accessibilityElementsHidden={true}
                    />
                    <Text className="text-text-secondary text-sm ml-sm flex-1">
                        {safetyFlags.allergenWarning}
                    </Text>
                </View>
            )}

            {/* Start Cooking button */}
            <View className="p-md">
                <Button
                    variant="primary"
                    onPress={handleStartCooking}
                    disabled={loading || isSaving}
                    className="w-full"
                    accessibilityRole="button"
                    accessibilityLabel={(loading || isSaving)
                        ? i18n.t('chat.saving')
                        : `${i18n.t('chat.startCooking')} ${recipeName}`}
                    accessibilityState={{ disabled: loading || isSaving }}
                >
                    {(loading || isSaving) ? (
                        <View className="flex-row items-center justify-center">
                            <ActivityIndicator size="small" color="white" />
                            <Text className="text-white font-semibold ml-sm">
                                {i18n.t('chat.saving')}
                            </Text>
                        </View>
                    ) : (
                        <View className="flex-row items-center justify-center">
                            <MaterialCommunityIcons name="chef-hat" size={20} color="white" accessibilityElementsHidden={true} />
                            <Text className="text-white font-semibold ml-sm">
                                {i18n.t('chat.startCooking')}
                            </Text>
                        </View>
                    )}
                </Button>
            </View>
        </View>
    );
}
