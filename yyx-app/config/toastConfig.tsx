import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/common';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import type { ToastConfig } from 'react-native-toast-message';

export const toastConfig: ToastConfig = {
  success: ({ text1, text2 }) => (
    <View
      className="bg-status-success rounded-md px-md py-sm mx-lg flex-row items-center shadow-lg"
      style={{
        shadowColor: COLORS.shadow.default,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
        maxWidth: '90%',
        minWidth: 280,
      }}
    >
      <Ionicons name="checkmark-circle" size={24} color={COLORS.neutral.white} />
      <View className="flex-1 ml-sm">
        {text1 && (
          <Text preset="body" className="text-white font-semibold">
            {text1}
          </Text>
        )}
        {text2 && (
          <Text preset="bodySmall" className="text-white">
            {text2}
          </Text>
        )}
      </View>
    </View>
  ),

  error: ({ text1, text2 }) => (
    <View
      className="bg-status-error rounded-md px-md py-sm mx-lg flex-row items-center shadow-lg"
      style={{
        shadowColor: COLORS.shadow.default,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
        maxWidth: '90%',
        minWidth: 280,
      }}
    >
      <Ionicons name="alert-circle" size={24} color={COLORS.neutral.white} />
      <View className="flex-1 ml-sm">
        {text1 && (
          <Text preset="body" className="text-white font-semibold">
            {text1}
          </Text>
        )}
        {text2 && (
          <Text preset="bodySmall" className="text-white">
            {text2}
          </Text>
        )}
      </View>
    </View>
  ),

  info: ({ text1, text2 }) => (
    <View
      className="bg-primary-medium rounded-md px-md py-sm mx-lg flex-row items-center shadow-lg"
      style={{
        shadowColor: COLORS.shadow.default,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
        maxWidth: '90%',
        minWidth: 280,
      }}
    >
      <Ionicons name="information-circle" size={24} color={COLORS.text.default} />
      <View className="flex-1 ml-sm">
        {text1 && (
          <Text preset="body" className="text-text-default font-semibold">
            {text1}
          </Text>
        )}
        {text2 && (
          <Text preset="bodySmall" className="text-text-default">
            {text2}
          </Text>
        )}
      </View>
    </View>
  ),

  warning: ({ text1, text2 }) => (
    <View
      className="bg-status-warning rounded-md px-md py-sm mx-lg flex-row items-center shadow-lg"
      style={{
        shadowColor: COLORS.shadow.default,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
        maxWidth: '90%',
        minWidth: 280,
      }}
    >
      <Ionicons name="warning" size={24} color={COLORS.neutral.white} />
      <View className="flex-1 ml-sm">
        {text1 && (
          <Text preset="body" className="text-white font-semibold">
            {text1}
          </Text>
        )}
        {text2 && (
          <Text preset="bodySmall" className="text-white">
            {text2}
          </Text>
        )}
      </View>
    </View>
  ),
};
