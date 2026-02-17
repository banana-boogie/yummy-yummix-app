/**
 * Custom Recipe Card
 *
 * Displays an AI-generated recipe with editable name and "Start Cooking" button.
 * Supports compact (collapsed) and expanded views.
 * Used in chat when the AI generates a custom recipe from user's ingredients.
 */
import React, { useState, useCallback, memo } from 'react';
import { View, TouchableOpacity, TextInput, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import type { GeneratedRecipe, SafetyFlags } from '@/types/irmixy';
import i18n from '@/i18n';
import { COLORS } from '@/constants/design-tokens';
import { PLACEHOLDER_IMAGES } from '@/constants/placeholders';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CustomRecipeCardProps {
    recipe: GeneratedRecipe;
    safetyFlags?: SafetyFlags;
    onStartCooking: (recipe: GeneratedRecipe, finalName: string, messageId: string, savedRecipeId?: string) => Promise<void>;
    loading?: boolean;
    messageId: string;
    savedRecipeId?: string;
    compact?: boolean;
}

export const CustomRecipeCard = memo(function CustomRecipeCard({
    recipe,
    safetyFlags,
    onStartCooking,
    loading = false,
    messageId,
    savedRecipeId,
    compact = true,
}: CustomRecipeCardProps) {
    const [recipeName, setRecipeName] = useState(recipe.suggestedName);
    const [isEditing, setIsEditing] = useState(false);
    const [isExpanded, setIsExpanded] = useState(!compact);
    const [showAllIngredients, setShowAllIngredients] = useState(false);
    const [showAllSteps, setShowAllSteps] = useState(false);
    const [isStartingCooking, setIsStartingCooking] = useState(false);
    const [showDisclaimer, setShowDisclaimer] = useState(false);

    const handleStartCooking = useCallback(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (__DEV__) {
            console.log('[CustomRecipeCard] Start cooking - recipe name:', recipeName, 'savedRecipeId:', savedRecipeId);
        }

        setIsStartingCooking(true);
        void onStartCooking(recipe, recipeName, messageId, savedRecipeId);
    }, [onStartCooking, recipe, recipeName, messageId, savedRecipeId]);

    const handleEditPress = useCallback(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsEditing(true);
    }, []);

    const handleEditComplete = useCallback(() => {
        setIsEditing(false);
        if (!recipeName.trim()) {
            setRecipeName(recipe.suggestedName);
        }
    }, [recipe.suggestedName, recipeName]);

    const handleExpand = useCallback(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsExpanded(true);
    }, []);

    const handleToggleDisclaimer = useCallback(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setShowDisclaimer((prev) => !prev);
    }, []);

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case 'easy': return COLORS.status.success;
            case 'medium': return COLORS.status.medium;
            case 'hard': return COLORS.status.error;
            default: return COLORS.grey.medium;
        }
    };

    const getDifficultyLabel = (difficulty: string) => {
        return i18n.t(`recipes.common.difficulty.${difficulty}`);
    };

    // Show first 5 ingredients or all if expanded
    const displayIngredients = showAllIngredients
        ? recipe.ingredients
        : recipe.ingredients.slice(0, 5);
    const moreIngredientsCount = recipe.ingredients.length - 5;

    // Show first 3 steps or all if expanded
    const displaySteps = showAllSteps
        ? recipe.steps
        : recipe.steps.slice(0, 3);
    const moreStepsCount = recipe.steps.length - 3;

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
                    {safetyFlags?.allergenWarning ||
                        safetyFlags?.dietaryConflict ||
                        i18n.t('chat.error.recipeGeneration')}
                </Text>
            </View>
        );
    }

    return (
        <View
            className="bg-white rounded-xl shadow-sm border border-border-default overflow-hidden mt-sm"
            accessible={true}
            accessibilityLabel={`${i18n.t('chat.customRecipe')}: ${recipeName}. ${recipe.totalTime} ${i18n.t('common.minutesShort')}, ${getDifficultyLabel(recipe.difficulty)}, ${recipe.portions} ${i18n.t('recipes.common.servings')}`}
        >
            {/* Header with editable recipe name */}
            <View className="bg-primary-lightest p-md border-b border-border-default">
                <TouchableOpacity
                    onPress={handleEditPress}
                    className="flex-row items-center"
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

                {/* Description (optional, from backend) */}
                {recipe.description ? (
                    <Text className="text-text-secondary text-sm mt-xs" numberOfLines={2}>
                        {recipe.description}
                    </Text>
                ) : null}

                {/* AI-generated recipe badge */}
                <TouchableOpacity
                    onPress={handleToggleDisclaimer}
                    className="flex-row items-center mt-sm"
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={i18n.t('chat.aiGeneratedRecipe')}
                >
                    <MaterialCommunityIcons
                        name="information-outline"
                        size={14}
                        color={COLORS.grey.medium_dark}
                    />
                    <Text className="text-text-secondary text-xs ml-xs">
                        {i18n.t('chat.aiGeneratedRecipe')}
                    </Text>
                    <MaterialCommunityIcons
                        name={showDisclaimer ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={COLORS.grey.medium_dark}
                        style={{ marginLeft: 2 }}
                    />
                </TouchableOpacity>
                {showDisclaimer && (
                    <View className="mt-xs bg-background-secondary rounded-md p-sm">
                        <Text className="text-text-secondary text-xs leading-relaxed">
                            {i18n.t('chat.aiGeneratedDisclaimer')}
                        </Text>
                    </View>
                )}
            </View>

            {/* Recipe info row (always visible) */}
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
                    <Text className="ml-xs font-medium" style={{ color: getDifficultyColor(recipe.difficulty) }}>
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

            {/* Compact summary line (only when collapsed) */}
            {!isExpanded && (
                <View className="px-md py-sm border-b border-border-default">
                    <Text className="text-text-secondary text-sm">
                        {i18n.t('chat.ingredientsSummary', { count: recipe.ingredients.length })} {' · '}
                        {i18n.t('chat.stepsSummary', { count: recipe.steps.length })}
                    </Text>
                </View>
            )}

            {/* Safety warning — always visible regardless of compact/expanded */}
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

            {/* Expanded content (ingredients, steps, useful items) */}
            {isExpanded && (
                <>
                    {/* Ingredient preview */}
                    <View
                        className="p-md border-b border-border-default"
                        accessible={true}
                        accessibilityRole="list"
                        accessibilityLabel={`${i18n.t('recipes.common.ingredients')}: ${displayIngredients.map((ing) => `${ing.quantity} ${ing.unit} ${ing.name}`).join(', ')}${moreIngredientsCount > 0 && !showAllIngredients ? ` ${i18n.t('chat.andMore', { count: moreIngredientsCount })}` : ''}`}
                    >
                        <Text className="text-text-secondary text-base font-medium mb-sm">
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
                                        className="w-14 h-14 rounded-full bg-background-tertiary"
                                        contentFit="cover"
                                        onError={() => {
                                            if (__DEV__) console.warn(`Failed to load image for ingredient: ${ingredient.name}`);
                                        }}
                                    />
                                    <View className="bg-background-secondary px-sm py-xs rounded-full">
                                        <Text className="text-text-primary text-base">
                                            {ingredient.quantity} {ingredient.unit} {ingredient.name}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                        {moreIngredientsCount > 0 && (
                            <TouchableOpacity
                                onPress={() => {
                                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setShowAllIngredients(!showAllIngredients);
                                }}
                                className="mt-md self-start bg-primary-lightest px-md py-sm rounded-lg border border-primary-medium flex-row items-center"
                                accessible={true}
                                accessibilityRole="button"
                                accessibilityLabel={showAllIngredients
                                    ? i18n.t('common.showLess')
                                    : i18n.t('common.showAll', { count: moreIngredientsCount })}
                            >
                                <MaterialCommunityIcons
                                    name={showAllIngredients ? 'chevron-up' : 'chevron-down'}
                                    size={16}
                                    color={COLORS.primary.darkest}
                                />
                                <Text className="text-primary-darkest text-sm font-semibold ml-xs">
                                    {showAllIngredients
                                        ? i18n.t('common.showLess')
                                        : i18n.t('common.showAll', { count: moreIngredientsCount })}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Steps preview */}
                    <View
                        className="p-md border-b border-border-default"
                        accessible={true}
                        accessibilityRole="list"
                        accessibilityLabel={`${i18n.t('recipes.common.instructions')}: ${displaySteps.length} ${i18n.t('recipes.common.steps')}`}
                    >
                        <Text className="text-text-secondary text-base font-medium mb-sm">
                            {i18n.t('recipes.common.instructions')}:
                        </Text>
                        <View className="gap-md">
                            {displaySteps.map((step) => (
                                <View key={step.order} className="flex-row">
                                    <View className="w-7 h-7 rounded-full bg-primary-medium items-center justify-center mr-sm mt-xs">
                                        <Text className="text-white text-sm font-semibold">
                                            {step.order}
                                        </Text>
                                    </View>
                                    <Text className="flex-1 text-text-primary text-base leading-relaxed">
                                        {step.instruction}
                                    </Text>
                                </View>
                            ))}
                        </View>
                        {moreStepsCount > 0 && (
                            <TouchableOpacity
                                onPress={() => {
                                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setShowAllSteps(!showAllSteps);
                                }}
                                className="mt-md self-start bg-primary-lightest px-md py-sm rounded-lg border border-primary-medium flex-row items-center"
                                accessible={true}
                                accessibilityRole="button"
                                accessibilityLabel={showAllSteps
                                    ? i18n.t('common.showLess')
                                    : i18n.t('common.showAll', { count: moreStepsCount })}
                            >
                                <MaterialCommunityIcons
                                    name={showAllSteps ? 'chevron-up' : 'chevron-down'}
                                    size={16}
                                    color={COLORS.primary.darkest}
                                />
                                <Text className="text-primary-darkest text-sm font-semibold ml-xs">
                                    {showAllSteps
                                        ? i18n.t('common.showLess')
                                        : i18n.t('common.showAll', { count: moreStepsCount })}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Useful items preview */}
                    {recipe.usefulItems && recipe.usefulItems.length > 0 && (
                        <View
                            className="p-md border-b border-border-default"
                            accessible={true}
                            accessibilityRole="list"
                            accessibilityLabel={`${i18n.t('recipes.common.usefulItems')}: ${recipe.usefulItems.length} ${i18n.t('common.items')}`}
                        >
                            <Text className="text-text-secondary text-base font-medium mb-sm">
                                {i18n.t('recipes.common.usefulItems')}:
                            </Text>
                            <View className="flex-row flex-wrap gap-sm">
                                {recipe.usefulItems.map((item, index) => (
                                    <View
                                        key={index}
                                        className="flex-row items-center bg-primary-lightest rounded-lg px-sm py-xs"
                                    >
                                        {item.imageUrl && (
                                            <Image
                                                source={{ uri: item.imageUrl }}
                                                style={{ width: 24, height: 24, borderRadius: 4 }}
                                                contentFit="cover"
                                            />
                                        )}
                                        <Text className="text-text-primary text-sm ml-xs">
                                            {item.name}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </>
            )}

            {/* Action buttons */}
            <View className="p-md">
                {!isExpanded ? (
                    <View className="flex-row gap-sm">
                        <Button
                            variant="outline"
                            onPress={handleExpand}
                            className="flex-1"
                            accessibilityLabel={i18n.t('chat.seeFullRecipe')}
                        >
                            <Text className="text-primary-darkest font-semibold text-center">
                                {i18n.t('chat.seeFullRecipe')}
                            </Text>
                        </Button>
                        <Button
                            variant="primary"
                            onPress={handleStartCooking}
                            disabled={loading || isStartingCooking}
                            loading={isStartingCooking}
                            className="flex-1"
                            accessibilityLabel={`${i18n.t('chat.startCooking')} ${recipeName}`}
                        >
                            <View className="flex-row items-center justify-center">
                                <MaterialCommunityIcons
                                    name="chef-hat"
                                    size={20}
                                    color="white"
                                    accessibilityElementsHidden={true}
                                />
                                <Text className="text-white font-semibold ml-sm">
                                    {i18n.t('chat.startCooking')}
                                </Text>
                            </View>
                        </Button>
                    </View>
                ) : (
                    <Button
                        variant="primary"
                        onPress={handleStartCooking}
                        disabled={loading || isStartingCooking}
                        loading={isStartingCooking}
                        className="w-full"
                        accessibilityLabel={`${i18n.t('chat.startCooking')} ${recipeName}`}
                    >
                        <View className="flex-row items-center justify-center">
                            <MaterialCommunityIcons
                                name="chef-hat"
                                size={20}
                                color="white"
                                accessibilityElementsHidden={true}
                            />
                            <Text className="text-white font-semibold ml-sm">
                                {i18n.t('chat.startCooking')}
                            </Text>
                        </View>
                    </Button>
                )}
            </View>
        </View>
    );
});
