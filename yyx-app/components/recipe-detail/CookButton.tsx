import { StyleProp, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Button } from '@/components/common/Button';
import i18n from '@/i18n';

interface CookButtonProps {
  className?: string;
  style?: StyleProp<ViewStyle>;
  recipeId?: string;
  size?: 'large' | 'medium';
}

export const CookButton: React.FC<CookButtonProps> = ({
  size = 'medium',
  className = '',
  style,
  recipeId
}) => {
  const router = useRouter();

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (recipeId) {
      router.push(`/(tabs)/recipes/${recipeId}/cooking-guide`);
    }
  };

  return (
    <Button
      variant='primary'
      size={size}
      label={i18n.t('recipes.cookingGuide.start')}
      onPress={handlePress}
      className={className}
      style={style}
    />
  );
};