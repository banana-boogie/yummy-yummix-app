import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useRecipe } from "@/hooks/useRecipe";
import { CookingGuideHeader } from "@/components/cooking-guide/CookingGuideHeader";
import { RecipeStepContent } from "@/components/cooking-guide/RecipeStepContent";
import i18n from "@/i18n";
import React, { useState } from "react";
import { Text } from "@/components/common";
import { StepNavigationButtons } from '@/components/cooking-guide/CookingGuideStepNavigationButtons';
import { PageLayout } from '@/components/layouts/PageLayout';
import { shouldDisplayRecipeSection } from '@/utils/recipes';
import { RecipeRatingModal } from '@/components/rating/RecipeRatingModal';
import { useAuth } from '@/contexts/AuthContext';
import { completionService } from '@/services/completionService';

export default function CookingStep() {
    const { id, step: stepParam } = useLocalSearchParams();
    const { recipe } = useRecipe(id as string);
    const { user } = useAuth();
    const [showRatingModal, setShowRatingModal] = useState(false);

    if (!recipe?.steps) return null;

    const currentStepNumber = Number(stepParam);
    const currentStep = recipe.steps[currentStepNumber - 1];

    // Guard against invalid step number or out of bounds
    if (!currentStep) return null;

    const isLastStep = currentStepNumber === recipe.steps.length;

    const handleNavigation = {
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
            // Record completion (for AI learning and rating gating)
            await completionService.recordCompletion(id as string);

            // If user is logged in, show rating modal
            if (user) {
                setShowRatingModal(true);
            } else {
                // For guests, go directly to recipes list
                router.replace('/(tabs)/recipes');
            }
        }
    };

    const handleRatingModalClose = () => {
        setShowRatingModal(false);
        router.replace('/(tabs)/recipes');
    };

    const Header = () => (
        <CookingGuideHeader
            title={i18n.t('recipes.cookingGuide.navigation.step', {
                step: currentStepNumber,
                total: recipe.steps?.length || 0
            })}
            showSubtitle={false}
            pictureUrl={recipe.pictureUrl}
            onBackPress={handleNavigation.back}
        />
    );

    const Footer = () => (
        <StepNavigationButtons
            onBack={handleNavigation.back}
            onNext={isLastStep ? handleNavigation.finish : handleNavigation.next}
            backText={i18n.t('recipes.cookingGuide.navigation.back')}
            nextText={i18n.t('recipes.cookingGuide.navigation.next')}
            isLastStep={isLastStep}
            finishText={i18n.t('recipes.cookingGuide.navigation.finish')}
        />
    );

    return (
        <PageLayout
            footer={<Footer />}
            backgroundColor="#f9f9f9"
            contentContainerStyle={{ paddingHorizontal: 0 }}
            contentPaddingHorizontal={0}
            scrollEnabled={true}
        >
            <Header />
            {currentStep.recipeSection && shouldDisplayRecipeSection(currentStep.recipeSection) ? (
                <View className="px-md">
                    <Text preset="h1" className="text-text-default mb-sm">
                        {currentStep.recipeSection}
                    </Text>
                </View>
            ) : null}
            <View className="px-md mb-md">
                <RecipeStepContent step={currentStep} />
            </View>

            {/* Rating Modal - shown on recipe completion for logged in users */}
            <RecipeRatingModal
                visible={showRatingModal}
                onClose={handleRatingModalClose}
                recipeId={id as string}
                recipeName={recipe.name}
            />
        </PageLayout>
    );
}

