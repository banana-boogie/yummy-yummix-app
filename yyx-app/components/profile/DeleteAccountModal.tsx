import React from 'react';
import { Modal, View, StyleProp, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';

import i18n from '@/i18n';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { DangerButton } from '@/components/common/DangerButton';
import { GradientHeader } from '@/components/common/GradientHeader';

interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
  className?: string; // Add className
  style?: StyleProp<ViewStyle>;
}

export function DeleteAccountModal({ visible, onClose, className = '', style }: DeleteAccountModalProps) {
  const handleDelete = () => {
    onClose();
    router.push('/settings/delete-account-feedback');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-center items-center">
        <View
          className={`w-[90%] max-w-[400px] bg-background-default rounded-lg overflow-hidden ${className}`}
          style={style}
        >
          <GradientHeader>
            <Text preset="h1" className="text-center my-md">
              {i18n.t('profile.deleteAccountFlow.title')}
            </Text>
          </GradientHeader>

          <View className="px-lg items-center">
            <Text className="text-center mb-lg">
              {i18n.t('profile.deleteAccountFlow.warning')}
            </Text>

            <Text className="text-center mb-xl font-medium">
              {i18n.t('profile.deleteAccountFlow.confirmQuestion')}
            </Text>

            <Button
              variant="primary"
              size="large"
              label={i18n.t('profile.deleteAccountFlow.cancel')}
              onPress={onClose}
              className="mb-lg w-full"
            />

            <DangerButton
              label={i18n.t('profile.deleteAccountFlow.delete')}
              onPress={handleDelete}
            />

            <Image
              source={require('@/assets/images/irmixy/irmixy-no.png')}
              className="w-[200px] h-[200px] mt-lg"
              contentFit="contain"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}