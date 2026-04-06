import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useRecipe } from "@/hooks/useRecipe";
import { CookingGuideHeader } from "@/components/cooking-guide/CookingGuideHeader";
import { RecipeStepContent } from "@/components/cooking-guide/RecipeStepContent";
import { AskIrmixyButton } from "@/components/cooking-guide/AskIrmixyButton";
import { IrmixyCookingModal } from "@/components/cooking-guide/IrmixyCookingModal";
import { useIrmixyHelperChat } from '@/hooks/useIrmixyHelperChat';
import { Text } from "@/components/common/Text";
import i18n from "@/i18n";
import React, { useMemo } from "react";
import { StepNavigationButtons } from '@/components/cooking-guide/CookingGuideStepNavigationButtons';
import { PageLayout } from '@/components/layouts/PageLayout';
import { shouldDisplayRecipeSection } from '@/utils/recipes';
import { eventService } from '@/services/eventService';
import { COLORS } from '@/constants/design-tokens';
import { buildRecipeContext } from '@/utils/recipeContext';

const contentContainerStyle = { paddingHorizontal: 0 } as const;

export default function CookingStep() {
    const { id, step: stepParam } = useLocalSearchParams();
    const { recipe } = useRecipe(id as string);
    const irmixy = useIrmixyHelperChat(id as string);

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
    ), [currentStepNumber, totalSteps, recipe?.pictureUrl, handleNavigation, id]);

    const footer = useMemo(() => (
        <View>
            <View className="items-center pb-sm pt-xs">
                <AskIrmixyButton
                    onPress={irmixy.open}
                    animate={currentStepNumber === 1}
                />
            </View>
            <View className="mx-lg mb-xs">
                <View className="h-[1px] bg-border-default opacity-30" />
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
    ), [handleNavigation, isLastStep, currentStepNumber, irmixy.open]);

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
            </PageLayout>

            <IrmixyCookingModal
                visible={irmixy.isVisible}
                onClose={irmixy.close}
                recipeContext={buildRecipeContext(recipe, {
                    type: 'cooking',
                    recipeId: id as string,
                    overrides: {
                        currentStep: currentStepNumber,
                        totalSteps,
                        stepInstructions: currentStep?.instruction,
                    },
                })}
                {...irmixy.sessionProps}
            />
        </View>
    );
}
