import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useRecipe } from "@/hooks/useRecipe";
import { CookingGuideHeader } from "@/components/cooking-guide/CookingGuideHeader";
import { RecipeStepContent } from "@/components/cooking-guide/RecipeStepContent";
import { Text } from "@/components/common/Text";
import i18n from "@/i18n";
import React, { useMemo, useState } from "react";
import { StepNavigationButtons } from '@/components/cooking-guide/CookingGuideStepNavigationButtons';
import { PageLayout } from '@/components/layouts/PageLayout';
import { shouldDisplayRecipeSection } from '@/utils/recipes';
import { eventService } from '@/services/eventService';
import { COLORS } from '@/constants/design-tokens';
import { RecipeRatingModal } from '@/components/rating/RecipeRatingModal';
import { useAuth } from '@/contexts/AuthContext';
import { completionService } from '@/services/completionService';

const contentContainerStyle = { paddingHorizontal: 0 } as const;

export default function CookingStep() {
    const { id, step: stepParam } = useLocalSearchParams();
    const { recipe } = useRecipe(id as string);
    const { user } = useAuth();
    const [showRatingModal, setShowRatingModal] = useState(false);

    const currentStepNumber = Number(stepParam);
    const steps = recipe?.steps;
    const currentStep = steps?.[currentStepNumber - 1];
    const totalSteps = steps?.length || 0;
    const isLastStep = currentStepNumber === totalSteps;

    const handleNavigation = useMemo(() => ({
        back: () => {
            const previousStep = currentStepNumber - 1;
            if (previousStep >= 1) {
                router.replace(`/(tabs)/recipes/${id}/cooking-guide/${previousStep}`);
            } else {
                router.back();
            }
        },
        next: () => {
            router.replace(`/(tabs)/recipes/${id}/cooking-guide/${currentStepNumber + 1}`);
        },
        finish: async () => {
            if (recipe?.id && recipe?.name) {
                eventService.logCookComplete(recipe.id, recipe.name);
            }
            await completionService.recordCompletion(id as string);
            if (user) {
                setShowRatingModal(true);
            } else {
                router.replace('/(tabs)/recipes');
            }
        }
    }), [id, currentStepNumber, recipe?.id, recipe?.name]);

    const recipeContext = useMemo(() => ({
        type: 'cooking' as const,
        recipeId: id as string,
        recipeTitle: recipe?.name ?? '',
        currentStep: currentStepNumber,
        totalSteps,
        stepInstructions: currentStep?.instruction ?? '',
        ingredients: currentStep?.ingredients?.map(ing => ({
            name: ing.name,
            amount: `${ing.formattedQuantity} ${ing.formattedUnit}`
        }))
    }), [id, recipe?.name, currentStepNumber, totalSteps, currentStep]);

    const handleRatingModalClose = () => {
        setShowRatingModal(false);
        router.replace('/(tabs)/recipes');
    };

    const header = useMemo(() => (
        <CookingGuideHeader
            title={i18n.t('recipes.cookingGuide.navigation.step', {
                step: currentStepNumber,
                total: totalSteps
            })}
            showSubtitle={false}
            pictureUrl={recipe?.pictureUrl}
            onBackPress={handleNavigation.back}
            recipeContext={recipeContext}
        />
    ), [currentStepNumber, totalSteps, recipe?.pictureUrl, handleNavigation, recipeContext]);

    const footer = useMemo(() => (
        <StepNavigationButtons
            onBack={handleNavigation.back}
            onNext={isLastStep ? handleNavigation.finish : handleNavigation.next}
            backText={i18n.t('recipes.cookingGuide.navigation.back')}
            nextText={i18n.t('recipes.cookingGuide.navigation.next')}
            isLastStep={isLastStep}
            finishText={i18n.t('recipes.cookingGuide.navigation.finish')}
        />
    ), [handleNavigation, isLastStep]);

    if (!steps || !currentStep) return null;

    return (
        <View className="flex-1">
            <PageLayout
                footer={footer}
                backgroundColor={COLORS.grey.light}
                contentContainerStyle={contentContainerStyle}
                contentPaddingHorizontal={0}
                scrollEnabled={true}
            >
                {header}
                {currentStep.recipeSection && shouldDisplayRecipeSection(currentStep.recipeSection) && (
                    <View className="px-sm mb-sm">
                        <Text preset="h2" className="text-text-secondary">
                            {currentStep.recipeSection}
                        </Text>
                    </View>
                )}
                <View className="px-md mb-md">
                    <RecipeStepContent step={currentStep} />
                </View>
            <RecipeRatingModal
                visible={showRatingModal}
                onClose={handleRatingModalClose}
                recipeId={id as string}
                recipeName={recipe.name}
            />
            </PageLayout>
        </View>
    );
}
