import React from 'react';
import { Text, TouchableOpacity, ImageBackground, View, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FilterCategory } from '@/types/filterCategory';
import { IMAGES } from '@/constants/images';

interface FilterCardProps {
  category: FilterCategory;
  isSelected: boolean;
  onSelect: (tag: string | string[]) => void;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export const FilterCard = ({
  category,
  isSelected,
  onSelect,
  className = '',
  style
}: FilterCardProps) => {
  return (
    <TouchableOpacity
      className={`
        w-[110px] h-[80px] mr-3 rounded-md overflow-hidden
        ${isSelected ? 'border-2 border-primary' : ''}
        ${className}
      `}
      style={style}
      onPress={() => onSelect(category.tag)}
      activeOpacity={0.7}
    >
      <ImageBackground
        source={category.imageUrl}
        className="w-full h-full justify-end"
        imageStyle={{ opacity: isSelected ? 0.9 : 1 }}
        defaultSource={IMAGES.FILTER_CATEGORIES.PLACEHOLDER}
      >
        {isSelected && (
          <View className="absolute top-2 right-2 z-10">
            <Ionicons name="checkmark-circle" size={24} className="text-primary" />
          </View>
        )}
        <View
          className={`absolute inset-0 ${isSelected ? 'bg-background-secondary/30' : 'bg-black/30'}`}
        />
        <Text
          className="text-white text-base p-2 text-center font-bold"
          style={{
            textShadowColor: 'rgba(0,0,0,0.5)',
            textShadowOffset: { width: 1, height: 1 },
            textShadowRadius: 2,
          }}
        >
          {category.name}
        </Text>
      </ImageBackground>
    </TouchableOpacity>
  );
};
