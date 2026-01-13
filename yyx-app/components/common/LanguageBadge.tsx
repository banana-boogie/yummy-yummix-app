import React from 'react';
import { View, ViewStyle, TextStyle } from 'react-native';
import { Text } from './Text';

interface LanguageBadgeProps {
  language: 'EN' | 'ES';
  size?: 'small' | 'regular';
  className?: string; // Add className support
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const LanguageBadge: React.FC<LanguageBadgeProps> = ({
  language,
  size = 'regular',
  className = '',
  style,
  textStyle,
}) => {
  return (
    <View
      className={`
        bg-primary-light self-start rounded-sm mr-xs
        ${size === 'small' ? 'px-xxs py-xxxs' : 'px-xs py-xxxs'}
        ${className}
      `}
      style={style}
    >
      <Text
        className={`
          text-primary-dark font-bold
          ${size === 'small' ? 'text-[10px]' : 'text-[12px]'}
        `}
        style={textStyle}
      >
        {language}
      </Text>
    </View>
  );
};