import { View } from 'react-native';
import { useState, useEffect } from 'react';
import { IrmixyCookingModal } from '@/components/cooking-guide/IrmixyCookingModal';
import { AskIrmixyButton } from '@/components/cooking-guide/AskIrmixyButton';
import { useIrmixyHelperChat } from '@/hooks/useIrmixyHelperChat';
import * as Haptics from 'expo-haptics';
import i18n from '@/i18n';
import { useRecipe } from '@/hooks/useRecipe';
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
import { buildRecipeContext } from '@/utils/recipeContext';

// Define the ingredient type
type CheckableIngredient = RecipeIngredient & { checked: boolean };

/**
 * Mise en place screen for the cooking guide - Ingredients Prep
 */
export default function IngredientsStep() {
  const { id } = useLocalSearchParams();
  const { recipe } = useRecipe(id as string);
  const [ingredients, setIngredients] = useState<CheckableIngredient[]>([]);
  const { isMobile } = useDevice();
  const irmixy = useIrmixyHelperChat(id as string);

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
    router.push(`/(tabs)/recipes/${id}/cooking-guide/1`);
  };

  return (
    <View style={{ flex: 1 }}>
      <PageLayout
        scrollEnabled={true}
        contentPaddingHorizontal={0}
        footer={
          <View>
            <View className="items-center pb-sm pt-xs">
              <AskIrmixyButton onPress={irmixy.open} />
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
        recipeContext={buildRecipeContext(recipe, {
          type: 'cooking',
          recipeId: id as string,
          overrides: {
            stepInstructions: i18n.t('chat.prepareIngredients'),
            ingredients: ingredients.map(ing => ({
              name: ing.name,
              amount: `${ing.formattedQuantity} ${ing.formattedUnit}`.trim(),
            })),
          },
        })}
        {...irmixy.sessionProps}
      />
    </View>
  );
}
