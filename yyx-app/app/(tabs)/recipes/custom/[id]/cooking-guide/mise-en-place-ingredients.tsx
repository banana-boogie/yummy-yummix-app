import { View } from 'react-native';
import { useState, useEffect } from 'react';
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

// Define the ingredient type
type CheckableIngredient = RecipeIngredient & { checked: boolean };

/**
 * Mise en place screen for custom recipe cooking guide - Ingredients Prep
 */
export default function CustomIngredientsStep() {
  const { id } = useLocalSearchParams();
  const { recipe } = useCustomRecipe(id as string);
  const [ingredients, setIngredients] = useState<CheckableIngredient[]>([]);
  const { isMobile } = useDevice();

  // Calculate number of columns based on screen size
  const numColumns = 2;

  useEffect(() => {
    if (recipe && recipe.ingredients) {
      setIngredients(recipe.ingredients.map(ing => ({ ...ing, checked: false })));
    }
  }, [recipe]);

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
    // If useful items exist, go to useful-items prep page
    if (recipe?.usefulItems && recipe.usefulItems.length > 0) {
      router.push(`/(tabs)/recipes/custom/${id}/cooking-guide/mise-en-place-useful-items`);
    } else {
      router.push(`/(tabs)/recipes/custom/${id}/cooking-guide/1`);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <PageLayout
        scrollEnabled={true}
        contentPaddingHorizontal={0}
        footer={
          <StepNavigationButtons
            onBack={() => router.back()}
            onNext={handleNext}
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
            recipeTitle: recipe?.name,
            stepInstructions: i18n.t('chat.prepareIngredients'),
            ingredients: ingredients.map(ing => ({
              name: ing.name,
              amount: `${ing.formattedQuantity} ${ing.formattedUnit}`
            }))
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
    </View>
  );
}
