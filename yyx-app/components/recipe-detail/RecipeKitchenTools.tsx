import { View, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';
import { Image } from 'expo-image';
import i18n from '@/i18n';
import { SectionHeading } from '@/components/recipe-detail/SectionHeading';
import { RecipeKitchenTool } from '@/types/recipe.types';

export interface RecipeKitchenToolsProps {
  kitchenTools: RecipeKitchenTool[];
  className?: string; // Add className
  style?: StyleProp<ViewStyle>;
}

export const RecipeKitchenTools: React.FC<RecipeKitchenToolsProps> = ({
  kitchenTools,
  className = '',
  style
}) => {
  if (!kitchenTools || kitchenTools.length === 0) return null;

  return (
    <View className={`mb-md ${className}`} style={style}>
      <SectionHeading heading={i18n.t('recipes.detail.kitchenTools.heading')} />
      <View className="flex-row justify-between flex-wrap gap-lg px-md lg:px-0">
        {kitchenTools.map((item) => (
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
