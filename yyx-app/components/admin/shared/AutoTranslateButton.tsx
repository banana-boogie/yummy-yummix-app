import React from 'react';
import { View, Pressable, Platform } from 'react-native';

import { Text } from '@/components/common/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

interface AutoTranslateButtonProps {
  onPress: () => void;
  loading: boolean;
  error?: string | null;
}

export function AutoTranslateButton({ onPress, loading, error }: AutoTranslateButtonProps) {
  return (
    <View>
      <Pressable
        onPress={onPress}
        disabled={loading}
        className="flex-row items-center gap-xxs px-md py-xs rounded-full border border-border-default"
        style={({ pressed }: { pressed: boolean }) => [
          { opacity: pressed || loading ? 0.5 : 1 },
          Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {},
        ]}
      >
        <Ionicons name="language-outline" size={14} color={COLORS.primary.medium} />
        <Text preset="caption" className="text-text-default">
          {loading
            ? i18n.t('admin.translate.translating')
            : i18n.t('admin.translate.autoTranslate')
          }
        </Text>
      </Pressable>
      {error ? (
        <Text preset="caption" className="text-status-error mt-xs">{error}</Text>
      ) : null}
    </View>
  );
}
