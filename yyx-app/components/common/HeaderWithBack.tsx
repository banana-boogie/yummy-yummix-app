import React from 'react';
import { View } from 'react-native';
import { GradientHeader } from './GradientHeader';
import { Text } from './Text';
import { BackButton } from '@/components/navigation/BackButton';

interface HeaderWithBackProps {
  title: string;
  children?: React.ReactNode;
}

export function HeaderWithBack({ title, children }: HeaderWithBackProps) {
  return (
    <GradientHeader contentClassName="px-md">
      <View className="py-sm md:py-md lg:py-lg flex-row items-baseline justify-between w-full">
        <View className="flex-1 items-start">
          <BackButton
            variant="light"
            className="ml-md"
          />
        </View>
        <View className="flex-[3] items-center">
          <Text preset="h1" className="text-center text-2xl md:text-3xl">
            {title}
          </Text>
        </View>
        <View className="flex-1" />
      </View>
      {children}
    </GradientHeader>
  );
}