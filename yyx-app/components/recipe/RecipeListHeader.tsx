import React from 'react';
import { View } from 'react-native';
import { GradientHeader } from '@/components/common/GradientHeader';
import { Text } from '@/components/common/Text';
import i18n from '@/i18n';
import { HamburgerMenu } from '@/components/navigation/HamburgerMenu';
import { useDevice } from '@/hooks/useDevice';
import { SPACING, FONT_SIZES } from '@/constants/design-tokens';

interface RecipeListHeaderProps {
  displayName: string;
  onLogoPress: () => void;
}

export const RecipeListHeader: React.FC<RecipeListHeaderProps> = ({
  displayName,
}) => {
  const { isWeb, isPhone, isLarge } = useDevice();
  const isWebMobile = isWeb && isPhone;

  return (
    <GradientHeader>
      <View
        className={`flex-row items-center justify-between w-full max-w-[1200px] self-center ${isPhone ? 'px-md' : 'px-0'} ${isLarge ? 'pl-[80px]' : ''}`}
      >
        <View className="flex-1 pt-xs pb-lg">
          <Text
            preset="subheading"
            className="text-text-default text-left"
            numberOfLines={1}
            marginBottom={0}
            style={{ fontSize: FONT_SIZES['2xl'] }}
          >
            {i18n.t('recipes.header.greeting', { name: displayName })}
          </Text>
        </View>

        {isWebMobile && (
          <HamburgerMenu style={{ alignSelf: 'center', marginBottom: SPACING.xxs }} />
        )}
      </View>
    </GradientHeader>
  );
};
