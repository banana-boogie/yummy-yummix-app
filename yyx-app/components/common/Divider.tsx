import React from 'react';
import { View, ViewStyle } from 'react-native';
import { Text } from './Text';

type DividerProps = {
  text?: string;
  dividerColor?: string; // Kept for backward compatibility but default now uses Tailwind class
  thickness?: number;
  opacity?: number;
  marginVertical?: number;
  className?: string;
  style?: ViewStyle;
};

export const Divider = ({
  text,
  dividerColor,
  thickness = 1,
  opacity = 1,
  marginVertical,
  className = '',
  style
}: DividerProps) => {
  return (
    <View
      className={`relative w-full justify-center items-center flex-row min-h-[20px] ${className}`}
      style={[
        marginVertical !== undefined ? { marginVertical } : { marginVertical: 10 },
        style
      ]}
    >
      {text ? (
        <>
          <View
            className={`flex-1 ${!dividerColor ? 'bg-grey-medium' : ''}`}
            style={{
              backgroundColor: dividerColor,
              height: thickness,
              opacity,
            }}
          />
          <Text preset="body" className="text-text-default text-xs md:text-sm lg:text-md mx-sm">
            {text}
          </Text>
          <View
            className={`flex-1 ${!dividerColor ? 'bg-grey-medium' : ''}`}
            style={{
              backgroundColor: dividerColor,
              height: thickness,
              opacity,
            }}
          />
        </>
      ) : (
        <View
          className={`w-full ${!dividerColor ? 'bg-grey-medium' : ''}`}
          style={{
            backgroundColor: dividerColor,
            height: thickness,
            opacity,
          }}
        />
      )}
    </View>
  );
};
