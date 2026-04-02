import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useCustomRecipe } from "@/hooks/useCustomRecipe";
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
import { COLORS } from '@/constants/design-tokens';
import { getCustomCookingGuidePath, isFromChat } from '@/utils/navigation/recipeRoutes';
import { eventService } from '@/services/eventService';
import { formatSpeedText } from '@/utils/thermomix/assetUtils';
export default function CustomCookingStep() {
    const { id, step: stepParam, from, session } = useLocalSearchParams<{ id: string; step: string; from?: string; session?: string }>();
    const { recipe } = useCustomRecipe(id as string);
    const isChatFlow = isFromChat(from);
    const irmixy = useIrmixyHelperChat(id);
    const chatRoute = session
        ? { pathname: '/(tabs)/chat' as const, params: { session: String(session) } }
        : '/(tabs)/chat' as const;

    const currentStepNumber = Number(stepParam);
    const steps = recipe?.steps;
    const currentStep = steps?.[currentStepNumber - 1];
    const totalSteps = steps?.length || 0;
    const isLastStep = currentStepNumber === totalSteps;

    const handleNavigation = useMemo(() => ({
        back: () => {
            const previousStep = currentStepNumber - 1;
            if (previousStep >= 1) {
                router.replace(getCustomCookingGuidePath(id as string, from, String(previousStep), session));
            } else {
                router.back();
            }
        },
        next: () => {
            router.replace(getCustomCookingGuidePath(id as string, from, String(currentStepNumber + 1), session));
        },
        finish: () => {
            if (recipe?.id && recipe?.name) {
                eventService.logCookComplete(recipe.id, recipe.name, 'user_recipes');
            }
            if (isChatFlow) {
                router.replace(chatRoute);
            } else {
                router.replace('/(tabs)/recipes');
            }
        }
    }), [id, currentStepNumber, from, recipe?.id, recipe?.name, isChatFlow, chatRoute]);

    const header = useMemo(() => (
        <CookingGuideHeader
            title={i18n.t('recipes.cookingGuide.navigation.step', {
                step: currentStepNumber,
                total: totalSteps
            })}
            showSubtitle={false}
            pictureUrl={recipe?.pictureUrl}
            isCustomRecipe={true}
            onBackPress={handleNavigation.back}
            onExitPress={() => {
                if (isChatFlow) {
                    router.replace(chatRoute);
                } else {
                    router.replace(`/(tabs)/recipes/custom/${id}`);
                }
            }}
        />
    ), [currentStepNumber, totalSteps, recipe?.pictureUrl, handleNavigation, isChatFlow, id]);

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
                visible={irmixy.isVisible}
                onClose={irmixy.close}
                recipeContext={{
                    type: 'cooking',
                    recipeId: id as string,
                    recipeTitle: recipe?.name ?? '',
                    currentStep: currentStepNumber,
                    totalSteps,
                    stepInstructions: currentStep?.instruction,
                    ingredients: recipe?.ingredients?.map((i) => ({
                        name: i.name,
                        amount: `${i.formattedQuantity} ${i.formattedUnit}`.trim(),
                    })),
                    kitchenTools: recipe?.kitchenTools?.map((t) => t.name),
                    allSteps: recipe?.steps?.map((s) => ({
                        order: s.order,
                        instruction: s.instruction,
                        thermomixTime: s.thermomix?.time,
                        thermomixSpeed: s.thermomix?.speed ? formatSpeedText(s.thermomix.speed) : null,
                    })),
                    portions: recipe?.portions,
                    totalTime: recipe?.totalTime ?? undefined,
                }}
                {...irmixy.sessionProps}
            />
        </View>
    );
}
