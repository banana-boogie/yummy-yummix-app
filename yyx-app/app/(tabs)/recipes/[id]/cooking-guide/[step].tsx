import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useRecipe } from "@/hooks/useRecipe";
import { CookingGuideHeader } from "@/components/cooking-guide/CookingGuideHeader";
import { RecipeStepContent } from "@/components/cooking-guide/RecipeStepContent";
import { AskIrmixyButton } from "@/components/cooking-guide/AskIrmixyButton";
import { IrmixyCookingModal } from "@/components/cooking-guide/IrmixyCookingModal";
import { Text } from "@/components/common/Text";
import i18n from "@/i18n";
import React, { useMemo, useEffect, useState } from "react";
import { StepNavigationButtons } from '@/components/cooking-guide/CookingGuideStepNavigationButtons';
import { PageLayout } from '@/components/layouts/PageLayout';
import { shouldDisplayRecipeSection } from '@/utils/recipes';
import { eventService } from '@/services/eventService';
import { useCookingSession } from '@/contexts/CookingSessionContext';
import { COLORS } from '@/constants/design-tokens';

export default function CookingStep() {
    const { id, step: stepParam } = useLocalSearchParams();
    const { recipe } = useRecipe(id as string);
    const { updateStep } = useCookingSession();
    const [showIrmixyModal, setShowIrmixyModal] = useState(false);

    const currentStepNumber = Number(stepParam);
    const steps = recipe?.steps;
    const currentStep = steps?.[currentStepNumber - 1];
    const totalSteps = steps?.length || 0;
    const isLastStep = currentStepNumber === totalSteps;

    // Keep CookingSessionContext in sync when the step changes
    useEffect(() => {
        if (recipe?.name && totalSteps > 0) {
            updateStep(currentStepNumber);
        }
    }, [currentStepNumber, recipe?.name, totalSteps, updateStep]);

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
        finish: () => {
            if (recipe?.id && recipe?.name) {
                eventService.logCookComplete(recipe.id, recipe.name);
            }
            router.replace('/(tabs)/recipes');
        }
    }), [id, currentStepNumber, recipe?.id, recipe?.name]);

    const header = useMemo(() => (
        <CookingGuideHeader
            title={i18n.t('recipes.cookingGuide.navigation.step', {
                step: currentStepNumber,
                total: totalSteps
            })}
            showSubtitle={false}
            pictureUrl={recipe?.pictureUrl}
            onBackPress={handleNavigation.back}
            onExitPress={() => router.replace(`/(tabs)/recipes/${id}`)}
        />
    ), [currentStepNumber, totalSteps, recipe?.pictureUrl, handleNavigation, router, id]);

    const footer = useMemo(() => (
        <View>
            <View className="items-center pb-xs">
                {currentStepNumber === 1 && (
                    <Text className="text-text-secondary text-xs mb-xxs">
                        {i18n.t('recipes.cookingGuide.navigation.needHelp')}
                    </Text>
                )}
                <AskIrmixyButton onPress={() => setShowIrmixyModal(true)} animate={currentStepNumber === 1} />
            </View>
            <StepNavigationButtons
                onBack={handleNavigation.back}
                onNext={isLastStep ? handleNavigation.finish : handleNavigation.next}
                backText={i18n.t('recipes.cookingGuide.navigation.back')}
                nextText={i18n.t('recipes.cookingGuide.navigation.next')}
                isLastStep={isLastStep}
                finishText={i18n.t('recipes.cookingGuide.navigation.finish')}
            />
        </View>
    ), [handleNavigation, isLastStep]);

    if (!steps || !currentStep) return null;

    return (
        <View className="flex-1">
            <PageLayout
                footer={footer}
                backgroundColor={COLORS.grey.light}
                contentContainerStyle={{ paddingHorizontal: 0 }}
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
            </PageLayout>

            <IrmixyCookingModal
                visible={showIrmixyModal}
                onClose={() => setShowIrmixyModal(false)}
                recipeContext={{
                    type: 'cooking',
                    recipeId: id as string,
                    recipeTitle: recipe?.name ?? '',
                    currentStep: currentStepNumber,
                    totalSteps,
                    stepInstructions: currentStep?.instruction,
                }}
            />
        </View>
    );
}
