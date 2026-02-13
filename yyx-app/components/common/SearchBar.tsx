// components/SearchBar.tsx
import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, TextInput as RNTextInput, Platform, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/constants/design-tokens';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchBarProps {
  style?: StyleProp<ViewStyle>;
  className?: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  placeholder?: string;
  /** Whether to enable debouncing (default: false) */
  useDebounce?: boolean;
  /** Debounce delay in milliseconds (default: 300) */
  debounceDelay?: number;
  /** Visual variant */
  variant?: 'default' | 'warm';
}

export const SearchBar: React.FC<SearchBarProps> = ({
  style,
  className = '',
  searchQuery,
  setSearchQuery,
  placeholder,
  useDebounce: enableDebounce = false,
  debounceDelay = 300,
  variant = 'default',
}) => {
  // Local state to track the input value
  const [inputValue, setInputValue] = useState(searchQuery);

  // Apply debounce if enabled
  const debouncedValue = enableDebounce ? useDebounce(inputValue, debounceDelay) : inputValue;

  // Update the search query when debounced value changes
  useEffect(() => {
    if (enableDebounce) {
      setSearchQuery(debouncedValue);
    }
  }, [debouncedValue, setSearchQuery, enableDebounce]);

  // Handle text changes
  const handleChangeText = (text: string) => {
    setInputValue(text);
    if (!enableDebounce) {
      setSearchQuery(text);
    }
  };

  const isWarm = variant === 'warm';
  const bgColor = isWarm ? COLORS.background.default : COLORS.grey.light;
  const borderColor = isWarm ? COLORS.primary.medium : 'transparent';
  const iconColor = isWarm ? COLORS.primary.dark : COLORS.grey.medium_dark;
  const placeholderColor = COLORS.grey.medium;

  return (
    <View className={`mb-md ${className}`} style={style}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: bgColor,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: borderColor,
          paddingHorizontal: 16,
          paddingVertical: Platform.OS === 'ios' ? 12 : 8,
        }}
      >
        <Ionicons name="search" size={20} color={iconColor} />
        <RNTextInput
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          value={inputValue}
          onChangeText={handleChangeText}
          style={[
            {
              flex: 1,
              marginLeft: 10,
              fontSize: 16,
              color: COLORS.text.default,
              fontFamily: 'Montserrat',
            },
            Platform.OS === 'web' ? { outlineWidth: 0 } as never : {},
          ]}
        />
        {inputValue.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setInputValue('');
              setSearchQuery('');
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={20} color={COLORS.grey.medium} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
