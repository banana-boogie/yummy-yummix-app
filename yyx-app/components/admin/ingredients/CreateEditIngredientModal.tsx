import React, { useState } from 'react';
import { Modal, KeyboardAvoidingView, Platform, ScrollView, View, Pressable } from 'react-native';
import { IngredientForm } from '@/components/admin/ingredients/IngredientForm';
import { adminIngredientsService } from '@/services/admin/adminIngredientsService';
import { AdminIngredient } from '@/types/recipe.admin.types';
import i18n from '@/i18n';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { AlertModal } from '@/components/common/AlertModal';
import { Text } from '@/components/common/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { useDevice } from '@/hooks/useDevice';
import logger from '@/services/logger';

interface CreateEditIngredientModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (newIngredient: AdminIngredient) => void;
  onDelete?: (ingredient: AdminIngredient) => void;
  ingredient?: AdminIngredient;
}

export function CreateEditIngredientModal({
  visible,
  onClose,
  onSuccess,
  onDelete,
  ingredient
}: CreateEditIngredientModalProps) {
  const { isPhone } = useDevice();
  const [saving, setSaving] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSaveIngredient = async (data: AdminIngredient) => {
    try {
      setSaving(true);
      let savedIngredient: AdminIngredient;
      if (ingredient?.id) {
        savedIngredient = await adminIngredientsService.updateIngredient(ingredient.id, data);
      } else {
        savedIngredient = await adminIngredientsService.createIngredient(data);
      }

      onSuccess?.(savedIngredient);
    } catch (error) {
      logger.error('Error saving ingredient:', error);
      throw error; // Re-throw so IngredientForm can handle and show error alert
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (ingredient && onDelete) {
      setShowDeleteConfirm(false);
      onClose();
      await onDelete(ingredient);
    }
  };

  const isEditing = !!ingredient?.id;

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={onClose}
      >
        <View
          className="flex-1 justify-center items-center bg-black/50"
          style={{ padding: isPhone ? 8 : 16 }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className={`bg-white rounded-xl w-full ${isPhone ? 'p-sm' : 'p-lg'}`}
            style={{
              maxWidth: isPhone ? '100%' : 800,
              maxHeight: isPhone ? '95%' : '90%',
            }}
          >
            {/* Close button */}
            <View className="flex-row justify-end mb-xs">
              <Pressable
                onPress={onClose}
                className="p-xs"
                style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}}
              >
                <Ionicons name="close" size={24} color={COLORS.text.secondary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 24, gap: 16 }}
            >
              {generalError ? (
                <ErrorMessage message={generalError} />
              ) : null}

              <IngredientForm
                ingredient={ingredient}
                onSave={handleSaveIngredient}
                onCancel={onClose}
                saving={saving}
                onDelete={isEditing && onDelete ? () => setShowDeleteConfirm(true) : undefined}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <AlertModal
        visible={showDeleteConfirm}
        title={i18n.t('admin.ingredients.confirmDeletion.title')}
        message={i18n.t('admin.ingredients.confirmDeletion.message')}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmText={i18n.t('common.delete')}
        isDestructive={true}
      />
    </>
  );
}
