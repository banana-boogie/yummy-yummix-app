import { View } from 'react-native';
import { useState, useEffect } from 'react';
import { IrmixyCookingModal } from '@/components/cooking-guide/IrmixyCookingModal';
import { AskIrmixyButton } from '@/components/cooking-guide/AskIrmixyButton';
import { useIrmixyHelperChat } from '@/hooks/useIrmixyHelperChat';
import * as Haptics from 'expo-haptics';
import i18n from '@/i18n';
import { useRecipe } from '@/hooks/useRecipe';
import { useLocalSearchParams, router } from 'expo-router';
import { CookingGuideHeader } from '@/components/cooking-guide/CookingGuideHeader';
import { CookingGuidePageHeader } from '@/components/cooking-guide/CookingGuidePageHeader';
import { StepNavigationButtons } from '@/components/cooking-guide/CookingGuideStepNavigationButtons';
import { useDevice } from '@/hooks/useDevice';
import { PageLayout } from '@/components/layouts/PageLayout';
import { MiseEnPlaceKitchenTool } from '@/components/cooking-guide/MiseEnPlaceKitchenTool';
import { Text } from '@/components/common/Text';
import { LAYOUT } from '@/constants/design-tokens';

type CheckableKitchenTool = {
    id: string;
    name: string;
    pictureUrl: string;
    checked: boolean;
};

/**
 * Kitchen tools prep screen for the cooking guide
 */
export default function KitchenToolsStep() {
    const { id } = useLocalSearchParams();
    const { recipe } = useRecipe(id as string);
    const [kitchenTools, setKitchenTools] = useState<CheckableKitchenTool[]>([]);
    const { isMobile } = useDevice();
    const irmixy = useIrmixyHelperChat(id as string);

    const numColumns = 2;

    useEffect(() => {
        if (recipe && recipe.kitchenTools) {
            setKitchenTools(recipe.kitchenTools.map(item => ({ ...item, checked: false })));
        }
    }, [recipe]);

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
                            <AskIrmixyButton onPress={irmixy.open} animate={false} />
                        </View>
                        <View className="mx-lg mb-xs">
                            <View className="h-[1px] bg-border-default opacity-30" />
                        </View>
                        <StepNavigationButtons
                            onBack={() => router.back()}
                            onNext={() => router.push(`/(tabs)/recipes/${id}/cooking-guide/mise-en-place-ingredients`)}
                            backText={i18n.t('recipes.cookingGuide.navigation.back')}
                            nextText={i18n.t('recipes.cookingGuide.navigation.next')}
                        />
                    </View>
                }
            >
                <CookingGuideHeader
                    showTitle={false}
                    pictureUrl={recipe?.pictureUrl}
                    onExitPress={() => router.replace(`/(tabs)/recipes/${id}`)}
                />

                <CookingGuidePageHeader
                    title={recipe?.name || ''}
                />

                {/* Content wrapper - centered on desktop with max-width */}
                <View
                    className="px-md pb-[120px]"
                    style={isMobile ? undefined : {
                        maxWidth: LAYOUT.maxWidth.cookingGuide,
                        alignSelf: 'center',
                        width: '100%'
                    }}
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
                visible={irmixy.isVisible}
                onClose={irmixy.close}
                recipeContext={{
                    type: 'prep',
                    recipeId: id as string,
                    recipeTitle: recipe?.name || '',
                    kitchenTools: kitchenTools.map(item => item.name)
                }}
                {...irmixy.sessionProps}
            />
        </View>
    );
}
