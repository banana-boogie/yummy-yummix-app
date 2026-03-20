import { View } from 'react-native';
import { useState, useEffect } from 'react';
import { IrmixyCookingModal } from '@/components/cooking-guide/IrmixyCookingModal';
import { AskIrmixyButton } from '@/components/cooking-guide/AskIrmixyButton';
import * as Haptics from 'expo-haptics';
import i18n from '@/i18n';
import { useCustomRecipe } from '@/hooks/useCustomRecipe';
import { useLocalSearchParams, router } from 'expo-router';
import { CookingGuideHeader } from '@/components/cooking-guide/CookingGuideHeader';
import { CookingGuidePageHeader } from '@/components/cooking-guide/CookingGuidePageHeader';
import { StepNavigationButtons } from '@/components/cooking-guide/CookingGuideStepNavigationButtons';
import { useDevice } from '@/hooks/useDevice';
import { PageLayout } from '@/components/layouts/PageLayout';
import { MiseEnPlaceKitchenTool } from '@/components/cooking-guide/MiseEnPlaceKitchenTool';
import { Text } from '@/components/common/Text';
import { LAYOUT } from '@/constants/design-tokens';
import { getCustomCookingGuidePath } from '@/utils/navigation/recipeRoutes';
import { useCookingSession } from '@/contexts/CookingSessionContext';

type CheckableKitchenTool = {
    id: string;
    name: string;
    pictureUrl: string;
    checked: boolean;
};

/**
 * Kitchen tools prep screen for custom recipe cooking guide
 */
export default function CustomKitchenToolsStep() {
    const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
    const { recipe } = useCustomRecipe(id as string);
    const [kitchenTools, setKitchenTools] = useState<CheckableKitchenTool[]>([]);
    const [showIrmixyModal, setShowIrmixyModal] = useState(false);
    const { isMobile } = useDevice();
    const {
        irmixyChatSessionId,
        setIrmixyChatSessionId,
        irmixyChatMessages,
        setIrmixyChatMessages,
        irmixyVoiceTranscriptMessages,
        setIrmixyVoiceTranscriptMessages,
    } = useCookingSession();

    // Calculate number of columns based on screen size
    const numColumns = 2;

    // Reset kitchen tools when recipe ID changes or recipe data loads
    // Adding `id` ensures state clears immediately when navigating to a different recipe
    useEffect(() => {
        if (recipe && recipe.kitchenTools) {
            setKitchenTools(recipe.kitchenTools.map(item => ({ ...item, checked: false })));
        } else {
            // Clear state when recipe is not yet loaded (e.g., navigating to new recipe)
            setKitchenTools([]);
        }
    }, [id, recipe]);

    // Effect to trigger success haptic when all items are checked
    useEffect(() => {
        const allKitchenToolsChecked = kitchenTools.length > 0 && kitchenTools.every(i => i.checked);
        if (allKitchenToolsChecked) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    }, [kitchenTools]);

    const handleKitchenToolPress = async (index: number) => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setKitchenTools(prev => prev.map((item, i) =>
            i === index ? { ...item, checked: !item.checked } : item
        ));
    };

    return (
        <View className="flex-1">
            <PageLayout
                scrollEnabled={true}
                contentPaddingHorizontal={0}
                footer={
                    <View>
                        <View className="items-center pb-sm pt-xs">
                            <AskIrmixyButton onPress={() => setShowIrmixyModal(true)} animate={false} />
                        </View>
                        <View className="mx-lg mb-xs">
                            <View className="h-[1px] bg-border-default opacity-30" />
                        </View>
                        <StepNavigationButtons
                            onBack={() => router.back()}
                            onNext={() => router.push(getCustomCookingGuidePath(id as string, from, '1'))}
                            backText={i18n.t('recipes.cookingGuide.navigation.back')}
                            nextText={i18n.t('recipes.cookingGuide.navigation.next')}
                        />
                    </View>
                }
            >
                <CookingGuideHeader
                    showTitle={false}
                    pictureUrl={recipe?.pictureUrl}
                    isCustomRecipe={true}
                    onExitPress={() => {
                        if (from === 'chat') {
                            router.replace('/(tabs)/chat');
                        } else {
                            router.replace(`/(tabs)/recipes/custom/${id}`);
                        }
                    }}
                />

                <CookingGuidePageHeader
                    title={recipe?.name || ''}
                />

                {/* Content wrapper - centered on desktop with max-width */}
                <View
                    className="px-md pb-[120px]"
                    style={!isMobile ? {
                        maxWidth: LAYOUT.maxWidth.cookingGuide,
                        alignSelf: 'center',
                        width: '100%'
                    } : undefined}
                >
                    <View className="mb-xl">
                        <Text preset="subheading" className="mb-sm">
                            {i18n.t('recipes.cookingGuide.miseEnPlace.kitchenTools.heading')}
                        </Text>
                        {/* Indented content grid */}
                        <View className="flex-row flex-wrap pl-sm">
                            {kitchenTools.map((item, index) => (
                                <MiseEnPlaceKitchenTool
                                    key={item.id}
                                    item={item}
                                    onPress={() => handleKitchenToolPress(index)}
                                    width={`${100 / numColumns}%`}
                                />
                            ))}
                        </View>
                    </View>
                </View>
            </PageLayout>
            <IrmixyCookingModal
                visible={showIrmixyModal}
                onClose={() => setShowIrmixyModal(false)}
                recipeContext={{
                    type: 'custom',
                    recipeId: id as string,
                    recipeTitle: recipe?.name || '',
                    kitchenTools: kitchenTools.map(item => item.name)
                }}
                externalSessionId={irmixyChatSessionId}
                onExternalSessionIdChange={setIrmixyChatSessionId}
                externalMessages={irmixyChatMessages}
                onExternalMessagesChange={setIrmixyChatMessages}
                externalVoiceTranscriptMessages={irmixyVoiceTranscriptMessages}
                onExternalVoiceTranscriptMessagesChange={setIrmixyVoiceTranscriptMessages}
            />
        </View>
    );
}
