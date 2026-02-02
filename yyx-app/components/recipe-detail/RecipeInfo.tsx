import React from 'react';
import { View, ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/common/Text';
import { RecipeDifficulty } from '@/types/recipe.types';
import i18n from '@/i18n';
import { formatTimeInHoursAndMinutes } from '@/utils/formatters';
import { Ionicons } from '@expo/vector-icons';

interface InfoItemProps {
  icon: ImageSourcePropType | string;
  label: string;
  value: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export interface RecipeInfoProps {
  totalTime: number | null;
  prepTime: number | null;
  difficulty: RecipeDifficulty;
  portions?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

const InfoItem: React.FC<InfoItemProps> = ({
  icon,
  label,
  value,
  className = '',
  style
}) => {
  return (
    <View className={`flex-row items-center gap-xs ${className}`} style={style}>
      <View className="items-center justify-center">
        {typeof icon === 'string' ? (
          <Ionicons
            name={icon as any}
            size={18}
            className="text-text-default"
          />
        ) : (
          <Image
            source={icon}
            className="w-6 h-6"
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        )}
      </View>
      <View className="flex-row gap-xxs items-center">
        <Text preset="caption" className="text-text-secondary">{label}:</Text>
        <Text preset="caption" className="text-text-default font-semibold">{value}</Text>
      </View>
    </View>
  );
};

export const RecipeInfo: React.FC<RecipeInfoProps> = ({
  totalTime,
  prepTime,
  portions,
  className = '',
  style
}) => {
  return (
    <View className={`flex-col gap-sm ${className}`} style={style}>
      <View className="flex-row flex-wrap gap-md">
        <InfoItem
          icon={require('@/assets/images/icons/total_time_icon.png')}
          label={i18n.t('recipes.common.totalTime')}
          value={formatTimeInHoursAndMinutes(totalTime)}
        />
        <InfoItem
          icon={require('@/assets/images/icons/prep_time_icon.png')}
          label={i18n.t('recipes.common.prepTime')}
          value={formatTimeInHoursAndMinutes(prepTime)}
        />
      </View>
      {portions && (
        <InfoItem
          icon="restaurant"
          label={i18n.t('recipes.common.portions')}
          value={portions.toString()}
        />
      )}
    </View>
  );
};