import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/common/Text';
import { COLORS } from '@/constants/design-tokens';
import { Ionicons } from '@expo/vector-icons';

export function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View>
      <TouchableOpacity onPress={() => setExpanded(!expanded)} className="flex-row items-center mt-lg mb-md">
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={20}
          color={COLORS.text.default}
          style={{ marginRight: 8 }}
        />
        <Text preset="h2">{title}</Text>
      </TouchableOpacity>
      {expanded && children}
    </View>
  );
}
