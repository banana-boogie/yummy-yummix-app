import { View } from 'react-native';
import { useState, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import i18n from '@/i18n';
import { useCustomRecipe } from '@/hooks/useCustomRecipe';
import { useLocalSearchParams, router } from 'expo-router';
import { CookingGuideHeader } from '@/components/cooking-guide/CookingGuideHeader';
import { CookingGuidePageHeader } from '@/components/cooking-guide/CookingGuidePageHeader';
import { StepNavigationButtons } from '@/components/cooking-guide/CookingGuideStepNavigationButtons';
import { useDevice } from '@/hooks/useDevice';
import { PageLayout } from '@/components/layouts/PageLayout';
import { MiseEnPlaceUsefulItem } from '@/components/cooking-guide/MiseEnPlaceUsefulItem';
import { Text } from '@/components/common/Text';
import { LAYOUT } from '@/constants/design-tokens';
import { getCustomCookingGuidePath } from '@/utils/navigation/recipeRoutes';

type CheckableUsefulItem = {
    id: string;
    name: string;
    pictureUrl: string;
    checked: boolean;
};

/**
 * Useful items prep screen for custom recipe cooking guide
 */
export default function CustomUsefulItemsStep() {
    const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
    const { recipe } = useCustomRecipe(id as string);
    const [usefulItems, setUsefulItems] = useState<CheckableUsefulItem[]>([]);
    const { isMobile } = useDevice();

    // Calculate number of columns based on screen size
    const numColumns = 2;

    // Reset useful items when recipe ID changes or recipe data loads
    // Adding `id` ensures state clears immediately when navigating to a different recipe
    useEffect(() => {
        if (recipe && recipe.usefulItems) {
            setUsefulItems(recipe.usefulItems.map(item => ({ ...item, checked: false })));
        } else {
            // Clear state when recipe is not yet loaded (e.g., navigating to new recipe)
            setUsefulItems([]);
        }
    }, [id, recipe]);

    // Effect to trigger success haptic when all items are checked
    useEffect(() => {
        const allUsefulItemsChecked = usefulItems.length > 0 && usefulItems.every(i => i.checked);
        if (allUsefulItemsChecked) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    }, [usefulItems]);

    const handleUsefulItemPress = async (index: number) => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setUsefulItems(prev => prev.map((item, i) =>
            i === index ? { ...item, checked: !item.checked } : item
        ));
    };

    return (
        <View className="flex-1">
            <PageLayout
                scrollEnabled={true}
                contentPaddingHorizontal={0}
                footer={
                    <StepNavigationButtons
                        onBack={() => router.back()}
                        onNext={() => router.push(getCustomCookingGuidePath(id as string, from, '1'))}
                        backText={i18n.t('recipes.cookingGuide.navigation.back')}
                        nextText={i18n.t('recipes.cookingGuide.navigation.next')}
                    />
                }
            >
                <CookingGuideHeader
                    showTitle={false}
                    pictureUrl={recipe?.pictureUrl}
                    isCustomRecipe={true}
                />

                <CookingGuidePageHeader
                    title={recipe?.name || ''}
                    recipeContext={{
                        type: 'custom',
                        recipeId: id as string,
                        recipeTitle: recipe?.name || '',
                        usefulItems: usefulItems.map(item => item.name)
                    }}
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
                            {i18n.t('recipes.cookingGuide.miseEnPlace.usefulItems.heading')}
                        </Text>
                        {/* Indented content grid */}
                        <View className="flex-row flex-wrap pl-sm">
                            {usefulItems.map((item, index) => (
                                <MiseEnPlaceUsefulItem
                                    key={item.id}
                                    item={item}
                                    onPress={() => handleUsefulItemPress(index)}
                                    width={`${100 / numColumns}%`}
                                />
                            ))}
                        </View>
                    </View>
                </View>
            </PageLayout>
        </View>
    );
}
