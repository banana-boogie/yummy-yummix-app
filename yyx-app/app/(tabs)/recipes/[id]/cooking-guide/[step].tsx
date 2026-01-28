import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useRecipe } from "@/hooks/useRecipe";
import { CookingGuideHeader } from "@/components/cooking-guide/CookingGuideHeader";
import { RecipeStepContent } from "@/components/cooking-guide/RecipeStepContent";
import { Text } from "@/components/common/Text";
import i18n from "@/i18n";
import React from "react";
import { StepNavigationButtons } from '@/components/cooking-guide/CookingGuideStepNavigationButtons';
import { PageLayout } from '@/components/layouts/PageLayout';
import { shouldDisplayRecipeSection } from '@/utils/recipes';

export default function CookingStep() {
    const { id, step: stepParam } = useLocalSearchParams();
    const { recipe } = useRecipe(id as string);

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
        finish: () => {
            router.replace('/(tabs)/recipes');
        }
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
            recipeContext={{
                type: 'cooking',
                recipeId: id as string,
                recipeTitle: recipe.name,
                currentStep: currentStepNumber,
                totalSteps: recipe.steps.length,
                stepInstructions: currentStep.instruction,
                ingredients: currentStep.ingredients?.map(ing => ({
                    name: ing.name,
                    amount: `${ing.formattedQuantity} ${ing.formattedUnit}`
                }))
            }}
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
        <View className="flex-1">
            <PageLayout
                footer={<Footer />}
                backgroundColor="#f9f9f9"
                contentContainerStyle={{ paddingHorizontal: 0 }}
                contentPaddingHorizontal={0}
                scrollEnabled={true}
            >
                <Header />
                {/* Show section title if present */}
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
            </PageLayout>
        </View>
    );
}
