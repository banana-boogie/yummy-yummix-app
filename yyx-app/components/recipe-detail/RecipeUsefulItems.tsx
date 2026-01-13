import { View, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';
import { Image } from 'expo-image';
import i18n from '@/i18n';
import { SectionHeading } from '@/components/recipe-detail/SectionHeading';
import { RecipeUsefulItem } from '@/types/recipe.types';

export interface RecipeUsefulItemsProps {
  usefulItems: RecipeUsefulItem[];
  className?: string; // Add className
  style?: StyleProp<ViewStyle>;
}

export const RecipeUsefulItems: React.FC<RecipeUsefulItemsProps> = ({
  usefulItems,
  className = '',
  style
}) => {
  if (!usefulItems || usefulItems.length === 0) return null;

  return (
    <View className={`mb-md ${className}`} style={style}>
      <SectionHeading heading={i18n.t('recipes.detail.usefulItems.heading')} />
      <View className="flex-row justify-between flex-wrap gap-lg px-md lg:px-0">
        {usefulItems.map((item) => (
          <View key={item.id} className="items-center w-[45%]">
            <Image
              source={item.pictureUrl}
              className="w-[100px] h-[100px]"
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={300}
            />
            <Text preset="handwritten" className="text-center">
              {item.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};
