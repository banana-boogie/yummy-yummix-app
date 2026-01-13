import React, { useState } from 'react';
import { Modal, KeyboardAvoidingView, Platform, View, ScrollView } from 'react-native';
import { IngredientForm } from '@/components/admin/ingredients/IngredientForm';
import { AdminIngredient } from '@/types/recipe.admin.types';
import i18n from '@/i18n';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { adminIngredientsService } from '@/services/admin/adminIngredientsService';
import { useDevice } from '@/hooks/useDevice';

interface CreateEditIngredientModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (newIngredient: AdminIngredient) => void;
  ingredient?: AdminIngredient;
}

export function CreateEditIngredientModal({
  visible,
  onClose,
  onSuccess,
  ingredient
}: CreateEditIngredientModalProps) {
  const { isPhone } = useDevice();
  const [saving, setSaving] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

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
      console.error('Error saving ingredient:', error);
      throw error; // Re-throw so IngredientForm can handle and show error alert
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
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
          <ScrollView
            showsVerticalScrollIndicator={true}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            {generalError ? (
              <ErrorMessage message={generalError} />
            ) : null}

            <IngredientForm
              ingredient={ingredient}
              onSave={handleSaveIngredient}
              onCancel={handleClose}
              saving={saving}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
