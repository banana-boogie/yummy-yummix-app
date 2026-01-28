import React from 'react';
import { Image, View } from 'react-native';
import { Text } from '@/components/common/Text';

interface IrmixyGuideProps {
  message: string;
}

export function IrmixyGuide({ message }: IrmixyGuideProps) {
  return (
    <View className="absolute right-4 bottom-6 items-end" pointerEvents="none">
      <View className="bg-white border border-primary-light rounded-2xl px-md py-sm shadow-sm max-w-[220px]">
        <Text preset="caption" className="text-xs text-grey-dark">
          {message}
        </Text>
      </View>
      <Image
        source={require('@/assets/images/irmixy/irmixy-hello.png')}
        className="w-16 h-16 mt-xs"
        resizeMode="contain"
      />
    </View>
  );
}
