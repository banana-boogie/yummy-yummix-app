import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useRecipe } from "@/hooks/useRecipe";
import { CookingGuideHeader } from "@/components/cooking-guide/CookingGuideHeader";
import { RecipeStepContent } from "@/components/cooking-guide/RecipeStepContent";
import i18n from "@/i18n";
import React from "react";
import { Text } from "@/components/common/Text";
import { StepNavigationButtons } from '@/components/cooking-guide/CookingGuideStepNavigationButtons';
import { PageLayout } from '@/components/layouts/PageLayout';
import { shouldDisplayRecipeSection } from '@/utils/recipes';
import { VoiceAssistantButton } from '@/components/common/VoiceAssistantButton';

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
            </PageLayout>
            <VoiceAssistantButton
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
        </View>
    );
}
