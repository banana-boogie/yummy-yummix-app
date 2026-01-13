import React from 'react';
import { View, TextInput, StyleProp, ViewStyle } from 'react-native';
import { Button } from '@/components/common/Button';
import { Feather } from '@expo/vector-icons';
import { Text } from '@/components/common/Text';
import { ErrorMessage } from '@/components/common/ErrorMessage';

interface OtherInputFieldProps {
  items: string[];
  onItemsChange: (items: string[]) => void;
  placeholder: string;
  error?: string;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  addButtonLabel?: string;
  className?: string; // Add className support
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>; // Backward compatibility
}

export function OtherInputField({
  items,
  onItemsChange,
  placeholder,
  error,
  onAddItem,
  onRemoveItem,
  addButtonLabel,
  className = '',
  style,
  containerStyle
}: OtherInputFieldProps) {
  const handleChangeText = (text: string, index: number) => {
    const newItems = [...items];
    newItems[index] = text;
    onItemsChange(newItems);
  };

  const handleAddItem = () => {
    if (items.length > 0) {
      const lastItem = items[items.length - 1];
      if (!lastItem.trim()) {
        return;
      }
    }
    onAddItem();
  };

  return (
    <View className={`px-sm gap-sm ${className}`} style={[style, containerStyle]}>
      {items.map((item, index) => (
        <View key={`input-${index}`} className="flex-row items-center">
          <TextInput
            value={item}
            onChangeText={(text) => handleChangeText(text, index)}
            placeholder={placeholder}
            placeholderTextColor="#9ca3af" // Tailwind gray-400
            className="flex-1 h-[50px] px-sm mr-xs border border-border-default rounded-lg text-text-default bg-background"
            autoCapitalize="none"
          />
          {items.length > 1 && (
            <Button
              onPress={() => onRemoveItem(index)}
              icon={<Feather name="x" size={16} className="text-text-default" />}
              variant="secondary"
              size="small"
              className="ml-xs mb-xs"
            />
          )}
        </View>
      ))}

      <Button
        onPress={handleAddItem}
        icon={<Feather name="plus" size={18} className="text-text-default" />}
        variant="secondary"
        size="small"
        className="mt-xs py-sm"
      >
        <Text>
          {addButtonLabel}
        </Text>
      </Button>

      {error && (
        <ErrorMessage message={error} />
      )}
    </View>
  );
}
