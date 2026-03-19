import React, { useCallback, useMemo } from 'react';
import { Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import {
  useUserCookbooksQuery,
  useAddRecipeToCookbook,
  useRemoveRecipeFromCookbook,
  useCookbooksContainingRecipe,
} from '@/hooks/useCookbookQuery';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

interface FavoriteHeartProps {
  recipeId: string;
  size?: number;
}

export const FavoriteHeart = React.memo(function FavoriteHeart({
  recipeId,
  size = 22,
}: FavoriteHeartProps) {
  const { user } = useAuth();
  const { data: cookbooks = [] } = useUserCookbooksQuery();
  const { data: containingCookbooks = [] } = useCookbooksContainingRecipe(recipeId);
  const addMutation = useAddRecipeToCookbook();
  const removeMutation = useRemoveRecipeFromCookbook();

  const defaultCookbook = useMemo(
    () => cookbooks.find((cb) => cb.isDefault),
    [cookbooks]
  );

  const isFavorited = useMemo(
    () =>
      defaultCookbook
        ? containingCookbooks.some((cb) => cb.id === defaultCookbook.id)
        : false,
    [containingCookbooks, defaultCookbook]
  );

  const isLoading = addMutation.isPending || removeMutation.isPending;

  const handleToggle = useCallback(async () => {
    if (!defaultCookbook || !user?.id || isLoading) return;

    try {
      if (isFavorited) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await removeMutation.mutateAsync({
          cookbookId: defaultCookbook.id,
          recipeId,
        });
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await addMutation.mutateAsync({
          cookbookId: defaultCookbook.id,
          recipeId,
        });
      }
    } catch {
      // Silently fail — optimistic updates handle rollback
    }
  }, [defaultCookbook, user?.id, isLoading, isFavorited, removeMutation, addMutation, recipeId]);

  if (!user?.id || !defaultCookbook) return null;

  return (
    <Pressable
      onPress={handleToggle}
      disabled={isLoading}
      accessibilityRole="button"
      accessibilityLabel={isFavorited ? i18n.t('cookbooks.a11y.removeFromFavorites') : i18n.t('cookbooks.a11y.addToFavorites')}
      accessibilityState={{ checked: isFavorited }}
      className="bg-white/80 rounded-full p-xs active:scale-90"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 2,
      }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons
        name={isFavorited ? 'heart' : 'heart-outline'}
        size={size}
        color={isFavorited ? COLORS.primary.darkest : COLORS.text.secondary}
      />
    </Pressable>
  );
});
