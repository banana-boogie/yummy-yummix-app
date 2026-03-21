import { View } from 'react-native';
import { useState, useEffect } from 'react';
import { IrmixyCookingModal } from '@/components/cooking-guide/IrmixyCookingModal';
import { AskIrmixyButton } from '@/components/cooking-guide/AskIrmixyButton';
import { useIrmixyHelperChat } from '@/hooks/useIrmixyHelperChat';
import * as Haptics from 'expo-haptics';
import i18n from '@/i18n';
import { useCustomRecipe } from '@/hooks/useCustomRecipe';
import { RecipeIngredient } from '@/types/recipe.types';
import { useLocalSearchParams, router } from 'expo-router';
import { CookingGuideHeader } from '@/components/cooking-guide/CookingGuideHeader';
import { CookingGuidePageHeader } from '@/components/cooking-guide/CookingGuidePageHeader';
import { StepNavigationButtons } from '@/components/cooking-guide/CookingGuideStepNavigationButtons';
import { useDevice } from '@/hooks/useDevice';
import { PageLayout } from '@/components/layouts/PageLayout';
import { MiseEnPlaceIngredient } from '@/components/cooking-guide/MiseEnPlaceIngredient';
import { Text } from '@/components/common/Text';
import { LAYOUT } from '@/constants/design-tokens';
import { getCustomCookingGuidePath } from '@/utils/navigation/recipeRoutes';

// Define the ingredient type
type CheckableIngredient = RecipeIngredient & { checked: boolean };

/**
 * Mise en place screen for custom recipe cooking guide - Ingredients Prep
 */
export default function CustomIngredientsStep() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const { recipe } = useCustomRecipe(id as string);
  const [ingredients, setIngredients] = useState<CheckableIngredient[]>([]);
  const { isMobile } = useDevice();
  const irmixy = useIrmixyHelperChat();

  const numColumns = 2;

  // Reset ingredients when recipe ID changes or recipe data loads
  // Adding `id` ensures state clears immediately when navigating to a different recipe
  useEffect(() => {
    if (recipe && recipe.ingredients) {
      setIngredients(recipe.ingredients.map(ing => ({ ...ing, checked: false })));
    } else {
      // Clear state when recipe is not yet loaded (e.g., navigating to new recipe)
      setIngredients([]);
    }
  }, [id, recipe]);

  // Effect to trigger success haptic when all ingredients are checked
  useEffect(() => {
    const allIngredientsChecked = ingredients.length > 0 && ingredients.every(i => i.checked);

    if (allIngredientsChecked) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [ingredients]);

  const handleIngredientPress = async (index: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIngredients(prev => prev.map((ing, i) =>
      i === index ? { ...ing, checked: !ing.checked } : ing
    ));
  };

  const handleNext = () => {
    // If kitchen tools exist, go to kitchen-tools prep page
    if (recipe?.kitchenTools && recipe.kitchenTools.length > 0) {
      router.push(getCustomCookingGuidePath(id as string, from, 'mise-en-place-kitchen-tools'));
    } else {
      router.push(getCustomCookingGuidePath(id as string, from, '1'));
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <PageLayout
        scrollEnabled={true}
        contentPaddingHorizontal={0}
        footer={
          <View>
            <View className="items-center pb-sm pt-xs">
              <AskIrmixyButton onPress={irmixy.open} animate={true} showHelpText={true} />
            </View>
            <View className="mx-lg mb-xs">
              <View className="h-[1px] bg-border-default opacity-30" />
            </View>
            <StepNavigationButtons
              onBack={() => router.back()}
              onNext={handleNext}
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
          style={isMobile ? undefined : {
            maxWidth: LAYOUT.maxWidth.cookingGuide,
            alignSelf: 'center',
            width: '100%'
          }}
        >
          {/* Ingredients Section */}
          <View className="mb-lg">
            <Text preset="subheading" className="mb-sm">
              {i18n.t('recipes.cookingGuide.miseEnPlace.ingredients.heading')}
            </Text>
            {/* Indented content grid */}
            <View className="flex-row flex-wrap pl-sm">
              {ingredients.map((ingredient, index) => (
                <MiseEnPlaceIngredient
                  key={ingredient.id}
                  ingredient={ingredient}
                  onPress={() => handleIngredientPress(index)}
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
          type: 'custom',
          recipeId: id as string,
          recipeTitle: recipe?.name,
          stepInstructions: i18n.t('chat.prepareIngredients'),
          ingredients: ingredients.map(ing => ({
            name: ing.name,
            amount: `${ing.formattedQuantity} ${ing.formattedUnit}`
          }))
        }}
        {...irmixy.sessionProps}
      />
    </View>
  );
}
