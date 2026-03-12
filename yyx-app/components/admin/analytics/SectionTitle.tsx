import React from 'react';
import { Text } from '@/components/common/Text';

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text preset="h2" className="text-text-default mb-md mt-lg">{children}</Text>
  );
}
