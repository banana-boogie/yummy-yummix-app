import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { SectionHeading } from '@/components/recipe-detail/SectionHeading';
import { renderRecipeText } from '@/components/recipe-detail/RenderRecipeText';
import i18n from '@/i18n';

interface RecipeTipProps {
  text: string | undefined;
  className?: string; // Add className
  style?: StyleProp<ViewStyle>;
}

export const RecipeTip: React.FC<RecipeTipProps> = ({
  text,
  className = '',
  style
}) => {
  if (!text) return null;

  return (
    <View className={className} style={style}>
      <SectionHeading heading={i18n.t('recipes.detail.tips')} />
      <View
        className="min-h-[150px] pt-[32px] pb-[24px] px-[24px] bg-[#FAF3E8] rounded-sm shadow-md"
      >
        <View
          className="absolute top-[-8px] self-center w-[80px] h-[20px]"
          style={{ transform: [{ rotate: '-2deg' }] }}
        />
        {renderRecipeText(text, {
          textStyle: { fontSize: 24, lineHeight: 32 },
        })}
      </View>
    </View>
  );
};