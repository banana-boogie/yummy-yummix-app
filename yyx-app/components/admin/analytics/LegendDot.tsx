import React from 'react';
import { View } from 'react-native';

export function LegendDot({ color }: { color: string }) {
  return (
    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
  );
}
