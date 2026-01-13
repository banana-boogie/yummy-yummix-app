import React from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Text } from '@/components/common/Text';

interface AlertModalProps {
  visible: boolean;
  title: string;
  message: string | React.ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  className?: string; // Add className support
  contentStyle?: StyleProp<ViewStyle>;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel',
  isDestructive = false,
  className = '',
  contentStyle,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onCancel}
    >
      <View className="flex-1 justify-center items-center bg-black/50 p-md">
        <View
          className={`bg-white rounded-lg p-lg w-full max-w-[400px] ${className}`}
          style={contentStyle}
        >
          <Text className="text-xl font-bold text-text-default mb-sm text-center">
            {title}
          </Text>

          {/* Render message as either string or React element */}
          {typeof message === 'string' ? (
            <Text className="text-base text-text-default mb-lg text-center">
              {message}
            </Text>
          ) : (
            <View className="mb-lg w-full">
              {message}
            </View>
          )}

          <View className="flex-row justify-center gap-md">
            {onCancel && (
              <TouchableOpacity
                className="py-sm px-lg rounded-lg min-w-[100px] items-center"
                onPress={onCancel}
              >
                <Text className="text-base font-bold text-text-default">{cancelText}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              className={`
                py-sm px-lg rounded-lg min-w-[100px] items-center
                ${isDestructive ? 'bg-status-error' : 'bg-primary-default'}
              `}
              onPress={onConfirm}
            >
              <Text className="text-base font-bold text-white">{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
