import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';

import { RecipeImage } from '@/components/recipe/RecipeImage';
import { BackButton } from '@/components/navigation/BackButton';
import { CookButton } from '@/components/recipe-detail/CookButton';
import { HamburgerMenu } from '@/components/navigation/HamburgerMenu';

import { useDevice } from '@/hooks/useDevice';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ImageHeaderProps {
    pictureUrl: string | undefined;
    onBackPress: () => void;
    className?: string;
    style?: StyleProp<ViewStyle>;
}

export const RecipeImageHeader: React.FC<ImageHeaderProps> = ({
    pictureUrl,
    onBackPress,
    className = '',
    style
}) => {
    if (!pictureUrl) return null;

    const { isLarge, isWeb, isPhone } = useDevice();
    const isWebMobile = isWeb && isPhone;
    const insets = useSafeAreaInsets();

    return (
        <View className={`flex w-full mb-sm ${className}`} style={style}>
            <RecipeImage
                pictureUrl={pictureUrl}
                aspectRatio={isLarge ? 21 / 9 : 16 / 9}
                width={'100%'}
            />
            <View
                className="absolute left-md right-md flex-row justify-between items-center z-1"
                style={{
                    top: (isWebMobile ? 24 : insets.top || 16) + 20
                }}
            >
                <BackButton onPress={onBackPress} />
                {isWebMobile && <HamburgerMenu />}
            </View>
        </View>
    );
};

interface StickyHeaderProps {
    visible: boolean;
    recipeId: string;
    className?: string;
    style?: StyleProp<ViewStyle>;
}

export const RecipeStickyHeader: React.FC<StickyHeaderProps> = ({
    visible,
    recipeId,
    className = '',
    style
}) => {
    const { isLarge } = useDevice();

    if (!visible) return null;

    return (
        <View
            className={`
                absolute top-0 left-0 right-0 z-10 bg-white border-b border-grey-medium shadow-md
                ${isLarge ? 'left-[80px] w-[calc(100%-80px)]' : ''}
                ${className}
            `}
            style={style}
        >
            <View className="pt-[64px] pb-lg px-lg md:pt-[48px] lg:pt-[32px]">
                <CookButton
                    recipeId={recipeId}
                    size="large"
                    className="w-full rounded-md"
                />
            </View>
        </View>
    );
};

