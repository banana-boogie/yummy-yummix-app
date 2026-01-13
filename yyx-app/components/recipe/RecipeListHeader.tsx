import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { GradientHeader } from '@/components/common/GradientHeader';
import { Text } from '@/components/common/Text';
import i18n from '@/i18n';
import { ResponsiveLayout } from '@/components/layouts/ResponsiveLayout';
import { HamburgerMenu } from '@/components/navigation/HamburgerMenu';
import { useDevice } from '@/hooks/useDevice';
import { COLORS, SPACING } from '@/constants/design-tokens';

interface RecipeListHeaderProps {
  displayName: string;
  onLogoPress: () => void;
}

export const RecipeListHeader: React.FC<RecipeListHeaderProps> = ({
  displayName,
  onLogoPress,
}) => {
  const { isWeb, isPhone, isLarge } = useDevice();
  const isWebMobile = isWeb && isPhone;

  return (
    <GradientHeader>
      <View
        className={`flex-row items-center justify-between w-full max-w-[1200px] self-center ${isPhone ? 'px-md' : 'px-0'} ${isLarge ? 'pl-[80px]' : ''}`}
      >
        <View className="flex-row items-center flex-1">
          <View className="flex-1">
            <Text
              preset="h1"
              className="text-2xl font-semibold text-text-default text-left"
              numberOfLines={2}
              marginBottom={0}
            >
              {i18n.t('header.greeting', { name: displayName })}
            </Text>
          </View>
        </View>

        {isWebMobile ? (
          <HamburgerMenu style={{ alignSelf: 'center', marginBottom: SPACING.xxs }} />
        ) : (
          <TouchableOpacity
            onPress={onLogoPress}
            hitSlop={{ top: 40, bottom: 40, left: 40, right: 40 }}
            className="shrink-0 mb-lg"
          >
            <Image
              source={require('@/assets/images/yyx_logo_header.png')}
              className="w-[70px] h-[70px]"
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          </TouchableOpacity>
        )}
      </View>
    </GradientHeader>
  );
};
