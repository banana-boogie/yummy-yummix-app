import React from 'react';
import { View, Modal, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';

interface StatusModalProps {
  visible: boolean;
  onClose: () => void;
  type: 'success' | 'error';
  message: string;
  showCloseButton?: boolean;
  className?: string; // Add className support
  style?: StyleProp<ViewStyle>;
}

export function StatusModal({
  visible,
  onClose,
  type,
  message,
  showCloseButton = false,
  className = '',
  style
}: StatusModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        className="flex-1 justify-center items-center bg-black/70"
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          className={`bg-background-default rounded-2xl p-6 items-center gap-2 min-w-[200px] ${className}`}
          style={style}
        >
          <Text
            preset="h1"
            className={`text-center ${type === 'error' ? 'text-status-error' : ''}`}
          >
            {type === 'success' ? '✓' : '!'}
          </Text>
          <Text
            preset="body"
            className={`text-center ${type === 'error' ? 'text-status-error' : ''}`}
          >
            {message}
          </Text>
          {showCloseButton && (
            <Button
              label="Close"
              onPress={onClose}
              variant="secondary"
              size="small"
              className="mt-4"
            />
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export default StatusModal;