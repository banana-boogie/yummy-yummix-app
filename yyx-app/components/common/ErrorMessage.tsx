import { View } from 'react-native';
import { Text } from '@/components/common/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';

interface ErrorMessageProps {
  message: string;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, className = '' }) => (
  <View className={`justify-center items-center p-md my-sm ${className}`}>
    <View className="bg-primary-lighter rounded-md p-md flex-row items-center max-w-[90%]">
      <Ionicons name="alert-circle" size={24} color={COLORS.status.error} style={{ marginRight: 8 }} />
      <Text preset="body" className="text-status-error text-base flex-1">{message}</Text>
    </View>
  </View>
);
