import React, { useState } from 'react';
import { Modal, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { KitchenToolForm } from '@/components/admin/kitchen-tools/KitchenToolForm';
import { adminKitchenToolsService } from '@/services/admin/adminKitchenToolsService';
import { AdminKitchenTool } from '@/types/recipe.admin.types';
import i18n from '@/i18n';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { useDevice } from '@/hooks/useDevice';
import logger from '@/services/logger';

interface CreateEditKitchenToolModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (newKitchenTool: AdminKitchenTool) => void;
  kitchenTool?: AdminKitchenTool;
}

export function CreateEditKitchenToolModal({
  visible,
  onClose,
  onSuccess,
  kitchenTool
}: CreateEditKitchenToolModalProps) {
  const { isPhone } = useDevice();
  const [saving, setSaving] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleSaveKitchenTool = async (data: AdminKitchenTool) => {
    try {
      setSaving(true);
      let savedKitchenTool: AdminKitchenTool;

      if (kitchenTool?.id) {
        savedKitchenTool = await adminKitchenToolsService.updateKitchenTool(kitchenTool.id, data);
      } else {
        savedKitchenTool = await adminKitchenToolsService.createKitchenTool(data);
      }

      onSuccess?.(savedKitchenTool);
      onClose();
    } catch (error) {
      logger.error('Error saving kitchen tool:', error);
      setGeneralError(i18n.t('admin.kitchenTools.errors.saveFailed') || 'Failed to save kitchen tool');
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

            <KitchenToolForm
              kitchenTool={kitchenTool}
              onSave={handleSaveKitchenTool}
              onCancel={onClose}
              saving={saving}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
