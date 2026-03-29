import React, { useState } from 'react';
import { Modal, KeyboardAvoidingView, Platform, ScrollView, View, Pressable } from 'react-native';
import { KitchenToolForm } from '@/components/admin/kitchen-tools/KitchenToolForm';
import { adminKitchenToolsService } from '@/services/admin/adminKitchenToolsService';
import { AdminKitchenTool } from '@/types/recipe.admin.types';
import i18n from '@/i18n';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { AlertModal } from '@/components/common/AlertModal';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { useDevice } from '@/hooks/useDevice';
import logger from '@/services/logger';

interface CreateEditKitchenToolModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (newKitchenTool: AdminKitchenTool) => void;
  onDelete?: (kitchenTool: AdminKitchenTool) => void;
  kitchenTool?: AdminKitchenTool;
}

export function CreateEditKitchenToolModal({
  visible,
  onClose,
  onSuccess,
  onDelete,
  kitchenTool
}: CreateEditKitchenToolModalProps) {
  const { isPhone } = useDevice();
  const [saving, setSaving] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
      const msg = error instanceof Error ? error.message : 'Failed to save kitchen tool';
      setGeneralError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (kitchenTool && onDelete) {
      setShowDeleteConfirm(false);
      onClose();
      await onDelete(kitchenTool);
    }
  };

  const isEditing = !!kitchenTool?.id;

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
          style={{ padding: isPhone ? 8 : 24 }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="bg-white rounded-xl w-full"
            style={{
              maxWidth: isPhone ? '100%' : 700,
              maxHeight: isPhone ? '95%' : '85%',
              padding: isPhone ? 16 : 24,
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

            {generalError ? (
              <ErrorMessage message={generalError} />
            ) : null}

            <ScrollView
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ flexGrow: 1 }}
            >
              <KitchenToolForm
                kitchenTool={kitchenTool}
                onSave={handleSaveKitchenTool}
                onCancel={onClose}
                onDelete={isEditing && onDelete ? () => setShowDeleteConfirm(true) : undefined}
                saving={saving}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <AlertModal
        visible={showDeleteConfirm}
        title={i18n.t('admin.kitchenTools.confirmDeletion.title')}
        message={i18n.t('admin.kitchenTools.confirmDeletion.message', {
          name: kitchenTool?.translations?.[0]?.name || '',
        })}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmText={i18n.t('common.delete')}
        isDestructive={true}
      />
    </>
  );
}
