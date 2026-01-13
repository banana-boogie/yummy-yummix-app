import React, { useRef, useEffect } from 'react';
import { ScrollView, View, StyleProp, ViewStyle } from 'react-native';
import { FilterCard } from './FilterCard';
import { filterCategories } from '@/data/filterCategories';

interface FilterRowProps {
  selectedTag: string;
  onSelectTag: (tag: string) => void;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export const FilterRow = ({
  selectedTag,
  onSelectTag,
  className = '',
  style
}: FilterRowProps) => {
  const scrollViewRef = useRef<ScrollView>(null);

  // Scroll to selected filter
  useEffect(() => {
    if (selectedTag && scrollViewRef.current) {
      // Find the index of the selected category
      const selectedIndex = filterCategories.findIndex(
        category => category.tag === selectedTag
      );

      if (selectedIndex !== -1) {
        // Calculate scroll position (card width + margin right) * index
        const scrollPosition = (110 + 12) * selectedIndex;

        // Scroll with animation
        scrollViewRef.current.scrollTo({
          x: scrollPosition,
          animated: true
        });
      }
    }
  }, [selectedTag]);

  return (
    <View className={`mb-lg ${className}`} style={style}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-1"
      >
        {filterCategories.map((category) => (
          <FilterCard
            key={category.id}
            category={category}
            isSelected={selectedTag === category.tag}
            onSelect={onSelectTag as (tag: string | string[]) => void}
          />
        ))}
      </ScrollView>
    </View>
  );
};
