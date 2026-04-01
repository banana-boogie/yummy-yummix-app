import React from 'react';
import { View, StyleProp, ViewStyle, StatusBar, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '@/components/common/Text';
import { LinearGradient } from 'expo-linear-gradient';
import { BackButton } from '@/components/navigation/BackButton';
import { HamburgerMenu } from '@/components/navigation/HamburgerMenu';
import { FONTS, TextPreset, COLORS, SPACING } from '@/constants/design-tokens';
import { SafeImage } from '@/components/common';
import { useDevice } from '@/hooks/useDevice';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import i18n from '@/i18n';

interface CookingGuideHeaderProps {
    title?: string;
    titlePreset?: TextPreset;
    subtitle?: string;
    subtitlePreset?: TextPreset;
    showTitle?: boolean;
    showSubtitle?: boolean;
    pictureUrl?: string;
    className?: string; // Add className
    style?: StyleProp<ViewStyle>;
    showBackButton?: boolean;
    onBackPress?: () => void;
    /** Flag to indicate custom recipe without image */
    isCustomRecipe?: boolean;
    /** When provided, renders an X (exit) button in the header */
    onExitPress?: () => void;
}

export function CookingGuideHeader({
    title,
    titlePreset = 'h1',
    showTitle = true,
    subtitle,
    subtitlePreset = 'h2',
    showSubtitle = true,
    pictureUrl,
    showBackButton = false,
    onBackPress,
    className = '',
    style,
    isCustomRecipe = false,
    onExitPress,
}: CookingGuideHeaderProps) {
    const { isLarge, isWeb, isPhone } = useDevice();
    const isWebMobile = isWeb && isPhone;
    const insets = useSafeAreaInsets();

    // Only show image if pictureUrl exists
    const showImage = !!pictureUrl;

    return (
        <View className={className} style={style}>
            <StatusBar barStyle={showImage ? "light-content" : "dark-content"} />

            {/* Safe area padding for custom recipes without image */}
            {!showImage && isCustomRecipe && (
                <View style={{ height: insets.top }} />
            )}

            {showImage && (
                <View className="w-full">
                    <View className="w-full h-[120px] lg:h-[250px]">
                        <SafeImage
                            source={pictureUrl}
                            className="w-full h-full"
                            contentFit="cover"
                            transition={300}
                            cachePolicy="memory-disk"
                        />
                        <LinearGradient
                            colors={[
                                'transparent',
                                `${COLORS.primary.lightest}1A`,
                                `${COLORS.primary.lightest}4D`,
                                `${COLORS.primary.lightest}80`,
                                `${COLORS.primary.lightest}B3`,
                                `${COLORS.primary.lightest}E6`,
                                COLORS.primary.lightest,
                            ]}
                            locations={[0, 0.2, 0.4, 0.6, 0.8, 0.9, 1]}
                            className="absolute bottom-0 left-0 right-0 h-[70px] lg:h-[140px]"
                        />
                        <View
                            className="absolute left-md right-md lg:left-lg lg:right-lg flex-row justify-between items-center z-1"
                            style={{
                                top: insets.top + (isLarge ? 16 : 10),
                            }}
                        >
                            {showBackButton && (
                                <BackButton onPress={onBackPress} className="bg-white/60" />
                            )}
                            <View className="flex-row items-center" style={{ marginLeft: 'auto' }}>
                                {onExitPress && (
                                    <TouchableOpacity
                                        onPress={onExitPress}
                                        className="flex-row items-center rounded-full bg-white/60 px-sm py-xs gap-xxs"
                                        accessibilityLabel={i18n.t('recipes.cookingGuide.navigation.exitCookingGuide')}
                                        accessibilityRole="button"
                                    >
                                        <MaterialCommunityIcons name="close" size={18} color={COLORS.text.default} />
                                        <Text className="text-text-default text-sm font-medium">
                                            {i18n.t('recipes.cookingGuide.navigation.exit')}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                {isWebMobile && <HamburgerMenu style={{ marginLeft: 8 }} />}
                            </View>
                        </View>
                    </View>
                </View>
            )}

            <View
                className="px-sm mt-md mb-xxs lg:mb-sm lg:max-w-[1000px] lg:self-center lg:w-full"
                style={{ position: 'relative' }}
            >
                <View className="flex-row justify-between items-center">
                    {!showImage && showBackButton && <BackButton onPress={onBackPress} className="mb-sm bg-black/5" />}
                    {!showImage && onExitPress && (
                        <TouchableOpacity
                            onPress={onExitPress}
                            className="flex-row items-center rounded-full bg-black/5 px-sm py-xs gap-xxs mb-sm"
                            accessibilityLabel={i18n.t('recipes.cookingGuide.navigation.exitCookingGuide')}
                            accessibilityRole="button"
                            style={{ marginLeft: 'auto' }}
                        >
                            <MaterialCommunityIcons name="close" size={18} color={COLORS.text.default} />
                            <Text className="text-text-default text-sm font-medium">
                                {i18n.t('recipes.cookingGuide.navigation.exit')}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Title */}
                {showTitle && title !== undefined ? (
                    <Text preset={titlePreset} className="mb-xxs">
                        {title}
                    </Text>
                ) : null}

                {showSubtitle && subtitle !== undefined ?
                    <Text preset={subtitlePreset}>
                        {subtitle}
                    </Text>
                    :
                    null
                }

            </View>
        </View>
    );
}
