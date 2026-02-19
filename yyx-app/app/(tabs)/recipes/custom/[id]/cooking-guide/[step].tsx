import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useCustomRecipe } from "@/hooks/useCustomRecipe";
import { CookingGuideHeader } from "@/components/cooking-guide/CookingGuideHeader";
import { RecipeStepContent } from "@/components/cooking-guide/RecipeStepContent";
import { Text } from "@/components/common/Text";
import i18n from "@/i18n";
import React from "react";
import { StepNavigationButtons } from '@/components/cooking-guide/CookingGuideStepNavigationButtons';
import { PageLayout } from '@/components/layouts/PageLayout';
import { shouldDisplayRecipeSection } from '@/utils/recipes';
import { COLORS } from '@/constants/design-tokens';
import { getCustomCookingGuidePath, isFromChat } from '@/utils/navigation/recipeRoutes';
import { eventService } from '@/services/eventService';

export default function CustomCookingStep() {
    const { id, step: stepParam, from } = useLocalSearchParams<{ id: string; step: string; from?: string }>();
    const { recipe } = useCustomRecipe(id as string);
    const isChatFlow = isFromChat(from);

    const currentStepNumber = Number(stepParam);
    const steps = recipe?.steps;
    const currentStep = steps?.[currentStepNumber - 1];
    const totalSteps = steps?.length || 0;

    if (!steps) return null;
    if (!currentStep) return null;

    const isLastStep = currentStepNumber === steps.length;

    const handleNavigation = {
        back: () => {
            const previousStep = currentStepNumber - 1;
            if (previousStep >= 1) {
                router.replace(getCustomCookingGuidePath(id as string, from, String(previousStep)));
            } else {
                router.back();
            }
        },
        next: () => {
            router.replace(getCustomCookingGuidePath(id as string, from, String(currentStepNumber + 1)));
        },
        finish: () => {
            if (recipe?.id && recipe?.name) {
                eventService.logCookComplete(recipe.id, recipe.name, 'user_recipes');
            }
            if (isChatFlow) {
                router.replace('/(tabs)/chat');
            } else {
                router.replace('/(tabs)/recipes');
            }
        }
    };

    const Header = () => (
        <CookingGuideHeader
            title={i18n.t('recipes.cookingGuide.navigation.step', {
                step: currentStepNumber,
                total: totalSteps
            })}
            showSubtitle={false}
            pictureUrl={recipe.pictureUrl}
            isCustomRecipe={true}
            onBackPress={handleNavigation.back}
            recipeContext={{
                type: 'custom',
                recipeId: id as string,
                recipeTitle: recipe.name,
                currentStep: currentStepNumber,
                totalSteps,
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
                backgroundColor={COLORS.grey.light}
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
