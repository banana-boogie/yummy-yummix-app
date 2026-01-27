import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, Animated } from 'react-native';
import { Text } from '@/components/common';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';
import type { ToastConfig, ToastConfigParams } from 'react-native-toast-message';

interface UndoToastProps extends ToastConfigParams<{ itemId: string; duration: number; onUndo: () => void }> {
    props?: {
        itemId: string;
        duration: number;
        onUndo: () => void;
    };
}

const UndoToast = ({ text1, text2, props }: UndoToastProps) => {
    const progress = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Reset progress when toast appears
        progress.setValue(1);

        if (props?.duration) {
            Animated.timing(progress, {
                toValue: 0,
                duration: props.duration,
                useNativeDriver: false,
            }).start();
        }
    }, [props?.duration, progress]);

    const progressWidth = progress.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <View
            className="bg-text-default rounded-md px-md py-sm mx-lg flex-row items-center shadow-lg"
            style={{
                shadowColor: COLORS.shadow.default,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
                elevation: 6,
                maxWidth: '90%',
                minWidth: 280,
            }}
        >
            <Ionicons name="trash-outline" size={20} color={COLORS.neutral.white} />
            <View className="flex-1 ml-sm mr-sm">
                {text1 && (
                    <Text preset="body" className="text-white font-semibold">
                        {text1}
                    </Text>
                )}
                {text2 && (
                    <Text preset="caption" className="text-grey-light" numberOfLines={1}>
                        {text2}
                    </Text>
                )}
                {/* Progress bar */}
                <View className="h-0.5 bg-grey-dark rounded-full mt-xs overflow-hidden">
                    <Animated.View
                        className="h-full bg-primary-medium rounded-full"
                        style={{ width: progressWidth }}
                    />
                </View>
            </View>
            <TouchableOpacity
                onPress={props?.onUndo}
                className="bg-primary-medium px-sm py-xs rounded-md"
                activeOpacity={0.7}
            >
                <Text preset="body" className="text-white font-semibold">
                    {i18n.t('common.undo')}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

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

  undo: (props: UndoToastProps) => <UndoToast {...props} />,
};
