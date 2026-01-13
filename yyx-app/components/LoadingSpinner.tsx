import { ActivityIndicator, View, StyleSheet } from 'react-native';

export const LoadingSpinner: React.FC = () => (
  <View style={styles.container}>
    <ActivityIndicator size="large" />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 