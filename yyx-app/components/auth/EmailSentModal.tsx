import React from 'react';
import { Modal, TouchableOpacity, Platform, View, StyleProp, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { FontAwesome } from '@expo/vector-icons';
import i18n from '@/i18n';
import { useDevice } from '@/hooks/useDevice';

interface EmailSentModalProps {
  visible: boolean;
  email: string;
  onOpenEmail: () => void;
  onClose: () => void;
  className?: string; // Add className
  style?: StyleProp<ViewStyle>;
}

export function EmailSentModal({ visible, email, onOpenEmail, onClose, className = '', style }: EmailSentModalProps) {
  const { isWeb, isPhone } = useDevice();
  const isMobileDevice = !isWeb || (isWeb && isPhone);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        className="flex-1 bg-black/50 justify-center items-center p-lg"
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          className={`bg-background-default rounded-[24px] w-full items-center shadow-md max-w-[450px] p-lg ${className}`}
          style={style}
        >
          <TouchableOpacity
            className="absolute top-3 left-3 p-2 z-1 bg-background-default rounded-[20px] shadow-sm"
            onPress={onClose}
          >
            <FontAwesome name="close" size={24} className="text-text-secondary" />
          </TouchableOpacity>

          <View className="w-full items-center">
            <Text preset="h1" className="mt-lg mb-md text-center">
              {i18n.t('auth.emailAuth.confirmation.title')}
            </Text>

            <Text preset="body" className="mb-md text-center text-[18px] font-semibold">
              {email}
            </Text>

            <Text preset="body" className="mb-md text-center text-base">
              {isMobileDevice
                ? i18n.t('auth.emailAuth.confirmation.message')
                : i18n.t('auth.emailAuth.confirmation.webMessage') || "Please check your email for a link to sign in."
              }
            </Text>

            <Text preset="body" className="mb-lg text-center text-text-secondary">
              {i18n.t('auth.emailAuth.confirmation.spamNote')}
            </Text>

            {/* Only show the "Open Email" button on mobile platforms */}
            {isMobileDevice && (
              <Button
                label={i18n.t('auth.emailAuth.confirmation.openEmail')}
                onPress={onOpenEmail}
                icon={<FontAwesome name="envelope" size={24} className="text-white" />}
                variant="primary"
                className="w-full px-lg py-lg"
                textClassName="ml-sm"
              />
            )}

            {/* Show a different button for web users */}
            {!isMobileDevice && (
              <Button
                label={i18n.t('auth.emailAuth.confirmation.gotIt') || "Got it"}
                onPress={onClose}
                variant="primary"
                className="w-full px-lg py-lg"
              />
            )}

            <Image
              source={require('@/assets/images/irmixy-avatar/irmixy-presenting.png')}
              className="w-[180px] h-[180px] mt-xl mb-[-24px]"
            />
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}