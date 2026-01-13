import React from 'react';
import { View } from 'react-native';
import { SPACING } from '@/constants/design-tokens';

interface FormDividerProps {
  spacing?: keyof typeof SPACING;
  className?: string; // Add className support
}

export function FormDivider({ spacing = 'xl', className = '' }: FormDividerProps) {
  // Map spacing key to tailwind class
  const marginClass = `my-${spacing}`;

  return <View className={`h-[1px] w-[90%] self-center bg-border-default opacity-50 shadow-md ${marginClass} ${className}`} />;
}

export default FormDivider;