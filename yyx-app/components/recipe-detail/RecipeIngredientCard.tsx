import { View, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';
import type { RecipeIngredientCardProps } from '@/types/recipe-interfaces';
import { IngredientImage } from '@/components/recipe-detail/IngredientImage';
import i18n from '@/i18n';
import { getIngredientName } from '@/utils/recipes/ingredients';

export const RecipeIngredientCard: React.FC<RecipeIngredientCardProps & { className?: string, style?: StyleProp<ViewStyle> }> = ({
  ingredient,
  className = '',
  style
}) => {
  return (
    <View className={`flex-row mb-md pl-xxs items-center ${className}`} style={style}>
      <IngredientImage source={ingredient.pictureUrl} />
      <View className="flex-1 flex-row flex-wrap items-center">
        <Text preset="handwritten" className="text-xl">{ingredient.formattedQuantity}</Text>
        <Text preset="handwritten" className="text-md ml-xxs mr-sm">{ingredient.formattedUnit}</Text>
        <Text preset="handwritten" className="text-xl ml-xs mb-0">{getIngredientName(ingredient)}</Text>
        {ingredient.notes ? <Text preset="handwritten" className="text-lg ml-xxs">{` (${ingredient.notes})`}</Text> : null}
        {ingredient.optional ? <Text preset="handwritten" className="text-md ml-sm">{`(${i18n.t('recipes.detail.ingredients.optional')})`}</Text> : null}
      </View>
    </View>
  );
};