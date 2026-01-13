import { View, StyleProp, ViewStyle } from 'react-native';
import { ReactNode } from 'react';

interface MessageBubbleProps {
  children: ReactNode;
  tailPosition?: 'left' | 'right' | 'none';
  className?: string; // Add className
  style?: StyleProp<ViewStyle>;
  contentContainerClassName?: string; // Add contentContainerClassName
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export function MessageBubble({
  children,
  tailPosition = 'none',
  className = '',
  style,
  contentContainerClassName = '',
  contentContainerStyle
}: MessageBubbleProps) {
  return (
    <View className={`relative min-h-[100px] ${className}`} style={style}>
      <View
        className={`bg-primary rounded-[20px] py-[14px] px-[16px] z-1 ${contentContainerClassName}`}
        style={contentContainerStyle}
      >
        {children}
      </View>
      {tailPosition !== 'none' && (
        <View
          className={`
            absolute bottom-[-25px] w-0 h-0 border-l-[30px] border-r-[30px] border-t-[40px] border-l-transparent border-r-transparent border-t-primary
            ${tailPosition === 'right' ? 'right-[30px]' : 'left-[30px]'}
          `}
          style={{ transform: [{ rotate: '20deg' }] }}
        />
      )}
    </View>
  );
}
