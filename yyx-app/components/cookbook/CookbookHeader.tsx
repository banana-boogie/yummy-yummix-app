import React, { useState } from 'react';
import { View, Pressable, Alert } from 'react-native';
import { Text } from '@/components/common';
import { Ionicons } from '@expo/vector-icons';
import { Cookbook } from '@/types/cookbook.types';
import { ShareCookbookModal } from './ShareCookbookModal';
import { CreateEditCookbookModal } from './CreateEditCookbookModal';
import { useUpdateCookbook, useDeleteCookbook } from '@/hooks/useCookbookQuery';
import { UpdateCookbookInput } from '@/types/cookbook.types';
import i18n from '@/i18n';
import { router } from 'expo-router';

interface CookbookHeaderProps {
  cookbook: Cookbook;
  onDelete?: () => void;
}

export function CookbookHeader({ cookbook, onDelete }: CookbookHeaderProps) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const updateMutation = useUpdateCookbook();
  const deleteMutation = useDeleteCookbook();

  // Simple deterministic gradient generator based on ID
  const RAW_GRADIENTS = [
    ['#FF9A9E', '#FECFEF'],
    ['#a18cd1', '#fbc2eb'],
    ['#fa709a', '#fee140'],
    ['#ff9a9e', '#fecfef'],
    ['#f6d365', '#fda085'],
    ['#84fab0', '#8fd3f4'],
    ['#a1c4fd', '#c2e9fb'],
    ['#cfd9df', '#e2ebf0'],
  ];

  const getGradientForId = (id: string) => {
    if (!id) return RAW_GRADIENTS[0];
    const charCode = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
    return RAW_GRADIENTS[charCode % RAW_GRADIENTS.length];
  };

  const colors = getGradientForId(cookbook.id);

  const handleEdit = async (input: UpdateCookbookInput) => {
    try {
      await updateMutation.mutateAsync({
        cookbookId: cookbook.id,
        input,
      });
      setShowEditModal(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update cookbook');
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
              router.back();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete cookbook');
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
        <View className="flex-row justify-end gap-sm mb-md">
          {!cookbook.isDefault && (
            <Pressable
              onPress={() => setShowShareModal(true)}
              className="bg-white/30 rounded-full p-sm active:bg-white/50"
            >
              <Ionicons name="share-outline" size={20} color="#2D2D2D" />
            </Pressable>
          )}

          <Pressable
            onPress={() => setShowEditModal(true)}
            className="bg-white/30 rounded-full p-sm active:bg-white/50"
          >
            <Ionicons name="create-outline" size={20} color="#2D2D2D" />
          </Pressable>

          {!cookbook.isDefault && (
            <Pressable
              onPress={handleDelete}
              className="bg-white/30 rounded-full p-sm active:bg-white/50"
            >
              <Ionicons name="trash-outline" size={20} color="#D83A3A" />
            </Pressable>
          )}
        </View>

        {/* Cookbook info */}
        <View>
          <View className="flex-row items-center mb-xs">
            {cookbook.isDefault && (
              <Ionicons name="heart" size={18} color="#D83A3A" className="mr-xs" />
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
              {cookbook.recipeCount}{' '}
              {cookbook.recipeCount === 1
                ? i18n.t('cookbooks.recipe')
                : i18n.t('cookbooks.recipes')}
            </Text>

            {!cookbook.isDefault && (
              <View className="flex-row items-center">
                <Ionicons
                  name={cookbook.isPublic ? 'globe-outline' : 'lock-closed'}
                  size={12}
                  color="#666"
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
      {!cookbook.isDefault && (
        <ShareCookbookModal
          visible={showShareModal}
          onClose={() => setShowShareModal(false)}
          cookbook={cookbook}
        />
      )}

      <CreateEditCookbookModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleEdit}
        cookbook={cookbook}
        isLoading={updateMutation.isPending}
      />
    </>
  );
}
