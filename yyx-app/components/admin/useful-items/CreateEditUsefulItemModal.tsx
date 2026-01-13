import React, { useState } from 'react';
import { Modal, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { UsefulItemForm } from '@/components/admin/useful-items/UsefulItemForm';
import { adminUsefulItemsService } from '@/services/admin/adminUsefulItemsService';
import { AdminUsefulItem } from '@/types/recipe.admin.types';
import i18n from '@/i18n';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { useDevice } from '@/hooks/useDevice';

interface CreateEditUsefulItemModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (newUsefulItem: AdminUsefulItem) => void;
  usefulItem?: AdminUsefulItem;
}

export function CreateEditUsefulItemModal({
  visible,
  onClose,
  onSuccess,
  usefulItem
}: CreateEditUsefulItemModalProps) {
  const { isPhone } = useDevice();
  const [saving, setSaving] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleSaveUsefulItem = async (data: AdminUsefulItem) => {
    try {
      setSaving(true);
      let savedUsefulItem: AdminUsefulItem;

      if (usefulItem?.id) {
        savedUsefulItem = await adminUsefulItemsService.updateUsefulItem(usefulItem.id, data);
      } else {
        savedUsefulItem = await adminUsefulItemsService.createUsefulItem(data);
      }

      onSuccess?.(savedUsefulItem);
      onClose();
    } catch (error) {
      console.error('Error saving useful item:', error);
      setGeneralError(i18n.t('admin.usefulItems.errors.saveFailed') || 'Failed to save useful item');
    } finally {
      setSaving(false);
    }
  };

  return (
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
          <ScrollView
            showsVerticalScrollIndicator={true}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            {generalError ? (
              <ErrorMessage message={generalError} />
            ) : null}

            <UsefulItemForm
              usefulItem={usefulItem}
              onSave={handleSaveUsefulItem}
              onCancel={onClose}
              saving={saving}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
