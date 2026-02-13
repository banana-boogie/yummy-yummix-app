import React, { useState } from 'react';
import { View, Pressable, Alert } from 'react-native';
import { Text } from '@/components/common';
import { Ionicons } from '@expo/vector-icons';
import { Cookbook } from '@/types/cookbook.types';
import { CreateEditCookbookModal } from './CreateEditCookbookModal';
import { useUpdateCookbook, useDeleteCookbook } from '@/hooks/useCookbookQuery';
import { UpdateCookbookInput } from '@/types/cookbook.types';
import { getGradientForCookbook } from '@/utils/gradients';
import { getRecipeCountText } from '@/utils/formatters';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

interface CookbookHeaderProps {
  cookbook: Cookbook;
  isOwner: boolean;
  onDelete?: () => void;
}

export const CookbookHeader = React.memo(function CookbookHeader({
  cookbook,
  isOwner,
  onDelete,
}: CookbookHeaderProps) {
  const [showEditModal, setShowEditModal] = useState(false);

  const updateMutation = useUpdateCookbook();
  const deleteMutation = useDeleteCookbook();

  const colors = getGradientForCookbook(cookbook.id);

  const handleEdit = async (input: UpdateCookbookInput) => {
    try {
      await updateMutation.mutateAsync({
        cookbookId: cookbook.id,
        input,
      });
      setShowEditModal(false);
    } catch (error) {
      const err = error as Error;
      Alert.alert(
        i18n.t('common.errors.title'),
        err.message || i18n.t('cookbooks.errors.updateFailed')
      );
    }
  };

  const handleDelete = () => {
    if (cookbook.isDefault) {
      Alert.alert(
        i18n.t('cookbooks.cannotDelete'),
        i18n.t('cookbooks.cannotDeleteFavorites')
      );
      return;
    }

    Alert.alert(
      i18n.t('cookbooks.deleteCookbook'),
      i18n.t('cookbooks.deleteConfirm'),
      [
        {
          text: i18n.t('common.cancel'),
          style: 'cancel',
        },
        {
          text: i18n.t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(cookbook.id);
              onDelete?.();
            } catch (error) {
              const err = error as Error;
              Alert.alert(
                i18n.t('common.errors.title'),
                err.message || i18n.t('cookbooks.errors.deleteFailed')
              );
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <View
        className="w-full h-48 justify-end p-lg"
        style={{ backgroundColor: colors[0] }}
      >
        {/* Action buttons */}
        {isOwner && (
          <View className="flex-row justify-end gap-sm mb-md">
            <Pressable
              onPress={() => setShowEditModal(true)}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('cookbooks.a11y.editCookbook')}
              className="bg-white/30 rounded-full p-sm active:bg-white/50"
            >
              <Ionicons name="create-outline" size={20} color={COLORS.text.default} />
            </Pressable>

            {!cookbook.isDefault && (
              <Pressable
                onPress={handleDelete}
                accessibilityRole="button"
                accessibilityLabel={i18n.t('cookbooks.a11y.deleteCookbook')}
                className="bg-white/30 rounded-full p-sm active:bg-white/50"
              >
                <Ionicons name="trash-outline" size={20} color={COLORS.primary.darkest} />
              </Pressable>
            )}
          </View>
        )}

        {/* Cookbook info */}
        <View>
          <View className="flex-row items-center mb-xs">
            {cookbook.isDefault && (
              <Ionicons name="heart" size={18} color={COLORS.primary.darkest} className="mr-xs" />
            )}
            <Text preset="h1" className="text-text-primary flex-1" numberOfLines={2}>
              {cookbook.name}
            </Text>
          </View>

          {cookbook.description && (
            <Text
              preset="body"
              className="text-text-secondary mb-sm"
              numberOfLines={2}
            >
              {cookbook.description}
            </Text>
          )}

          <View className="flex-row items-center gap-md">
            <Text preset="caption" className="text-text-secondary">
              {getRecipeCountText(cookbook.recipeCount, i18n)}
            </Text>

            {!cookbook.isDefault && (
              <View className="flex-row items-center">
                <Ionicons
                  name={cookbook.isPublic ? 'globe-outline' : 'lock-closed'}
                  size={12}
                  color={COLORS.text.secondary}
                />
                <Text preset="caption" className="text-text-secondary ml-xs">
                  {cookbook.isPublic
                    ? i18n.t('cookbooks.public')
                    : i18n.t('cookbooks.private')}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Modals */}
      {isOwner && (
        <CreateEditCookbookModal
          visible={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSave={handleEdit}
          cookbook={cookbook}
          isLoading={updateMutation.isPending}
        />
      )}
    </>
  );
}, (prevProps, nextProps) => {
    return (
        prevProps.cookbook.id === nextProps.cookbook.id &&
        prevProps.isOwner === nextProps.isOwner &&
        prevProps.cookbook.updatedAt === nextProps.cookbook.updatedAt &&
        prevProps.cookbook.name === nextProps.cookbook.name &&
        prevProps.cookbook.description === nextProps.cookbook.description &&
        prevProps.cookbook.isPublic === nextProps.cookbook.isPublic &&
        prevProps.cookbook.recipeCount === nextProps.cookbook.recipeCount &&
        prevProps.cookbook.shareEnabled === nextProps.cookbook.shareEnabled &&
        prevProps.cookbook.shareToken === nextProps.cookbook.shareToken
    );
});
