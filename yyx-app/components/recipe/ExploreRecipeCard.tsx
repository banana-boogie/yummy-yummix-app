/**
 * ExploreRecipeCard
 *
 * Wraps WatercolorRecipeCard with an "Add to Plan" affordance for the
 * Explore page. The underlying card is shared across the app so we avoid
 * modifying it directly.
 */

import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WatercolorRecipeCard } from '@/components/recipe/WatercolorRecipeCard';
import { COLORS, SPACING } from '@/constants/design-tokens';
import type { Recipe } from '@/types/recipe.types';
import i18n from '@/i18n';

interface ExploreRecipeCardProps {
  recipe: Recipe;
  compact?: boolean;
  onAddToPlan: (recipe: Recipe) => void;
}

function t(key: string, fallback: string): string {
  const v = i18n.t(`recipes.addToPlan.${key}`);
  return v.startsWith('[missing') ? fallback : v;
}

export const ExploreRecipeCard = React.memo(function ExploreRecipeCard({
  recipe,
  compact,
  onAddToPlan,
}: ExploreRecipeCardProps) {
  return (
    <View>
      <WatercolorRecipeCard recipe={recipe} compact={compact} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('title', 'Add to Plan')}
        hitSlop={8}
        onPress={() => onAddToPlan(recipe)}
        style={{
          position: 'absolute',
          top: SPACING.sm,
          right: SPACING.sm,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: COLORS.background.default,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.15,
          shadowRadius: 3,
          elevation: 2,
        }}
      >
        <Ionicons name="add" size={26} color={COLORS.primary.darkest} />
      </Pressable>
    </View>
  );
});
