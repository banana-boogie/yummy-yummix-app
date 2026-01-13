import React, { useState } from 'react';
import { View, TouchableOpacity, Modal, ScrollView, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/common/Button';

interface MultiSelectOption {
  label: string;
  value: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selectedValues: string[];
  onValueChange: (values: string[]) => void;
  placeholder?: string;
  className?: string; // Add className support
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>; // Backward compatibility
}

export function MultiSelect({
  options,
  selectedValues,
  onValueChange,
  placeholder = 'Select options',
  className = '',
  style,
  containerStyle
}: MultiSelectProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [tempSelectedValues, setTempSelectedValues] = useState<string[]>(selectedValues);

  const toggleOption = (value: string) => {
    setTempSelectedValues(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const handleConfirm = () => {
    onValueChange(tempSelectedValues);
    setModalVisible(false);
  };

  const handleCancel = () => {
    setTempSelectedValues(selectedValues);
    setModalVisible(false);
  };

  const selectedLabels = options
    .filter(option => selectedValues.includes(option.value))
    .map(option => option.label)
    .join(', ');

  return (
    <View className={className} style={[style, containerStyle]}>
      <TouchableOpacity
        className="flex-row items-center justify-between h-12 px-md bg-background-secondary rounded-lg"
        onPress={() => setModalVisible(true)}
      >
        <Text
          className={`
            flex-1 text-base
            ${selectedLabels ? 'text-text-default' : 'text-text-secondary'}
          `}
          numberOfLines={1}
        >
          {selectedLabels || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={24} className="text-text-secondary" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-background rounded-t-2xl max-h-[80%]">
            <View className="flex-row justify-between items-center p-md border-b border-border-default">
              <Button
                variant="secondary"
                onPress={handleCancel}
                label="Cancel"
                size="small"
              />
              <Text className="flex-1 text-center font-semibold">{placeholder}</Text>
              <Button
                variant="primary"
                onPress={handleConfirm}
                label="Done"
                size="small"
              />
            </View>

            <ScrollView className="p-md">
              {options.map((option) => {
                const isSelected = tempSelectedValues.includes(option.value);
                return (
                  <TouchableOpacity
                    key={option.value}
                    className={`
                      flex-row items-center py-sm px-md border-b border-border-default
                      ${isSelected ? 'bg-primary-light rounded-lg' : ''}
                    `}
                    onPress={() => toggleOption(option.value)}
                  >
                    <View className="flex-1 flex-row items-center">
                      <View className="w-6 mr-sm items-center">
                        {isSelected ? (
                          <Ionicons name="checkmark-circle" size={24} className="text-primary-medium" />
                        ) : (
                          <View className="w-6 h-6 rounded-full border-2 border-border-default" />
                        )}
                      </View>
                      <Text className={`
                        text-base flex-1
                        ${isSelected ? 'text-text-default font-semibold' : 'text-text-default'}
                      `}>
                        {option.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
