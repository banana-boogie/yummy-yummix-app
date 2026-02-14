import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/common/Text';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

interface PreferenceSummaryProps {
  label: string;
  selected: string[];
  onEdit: () => void;
  emptyText: string;
}

export const PreferenceSummary = React.memo(function PreferenceSummary({ label, selected, onEdit, emptyText }: PreferenceSummaryProps) {
  return (
    <View className="gap-sm pb-lg border-b border-grey-default">
      <View className="flex-row justify-between items-center">
        <Text preset="subheading">{label}</Text>
        <TouchableOpacity onPress={onEdit} className="flex-row items-center gap-xxs">
          <Feather name="edit-2" size={14} color={COLORS.primary.medium} />
          <Text preset="link" className="text-primary-medium">
            {i18n.t('profile.summaries.edit')}
          </Text>
        </TouchableOpacity>
      </View>
      {selected.length > 0 ? (
        <View className="flex-row flex-wrap gap-xs">
          {selected.map((item) => (
            <View key={item} className="bg-primary-light rounded-full px-sm py-xxs">
              <Text preset="caption">{item}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text preset="caption" className="text-text-secondary">
          {emptyText}
        </Text>
      )}
    </View>
  );
});
