// components/FilterBar.tsx
import React from 'react';
import { View, Button, StyleSheet } from 'react-native';

interface FilterBarProps {
  selectedDifficulty: string | null;
  setSelectedDifficulty: (difficulty: string | null) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
  selectedDifficulty,
  setSelectedDifficulty,
}) => {
  return (
    <View style={styles.filterBar}>
      <Button title="All" onPress={() => setSelectedDifficulty(null)} />
      <Button title="Easy" onPress={() => setSelectedDifficulty('Easy')} />
      <Button title="Medium" onPress={() => setSelectedDifficulty('Medium')} />
      <Button title="Hard" onPress={() => setSelectedDifficulty('Hard')} />
    </View>
  );
};

const styles = StyleSheet.create({
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },
});

export default FilterBar;
