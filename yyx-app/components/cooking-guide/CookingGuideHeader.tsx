import React from 'react';
import { View, StyleProp, ViewStyle, StatusBar } from 'react-native';
import { Text } from '@/components/common/Text';
import { LinearGradient } from 'expo-linear-gradient';
import { BackButton } from '@/components/navigation/BackButton';
import { HamburgerMenu } from '@/components/navigation/HamburgerMenu';
import { FONTS, TextPreset } from '@/constants/design-tokens';
import { Image } from 'expo-image';
import { useDevice } from '@/hooks/useDevice';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VoiceAssistantButton } from '@/components/common/VoiceAssistantButton';
import type { RecipeContext } from '@/services/voice/types';

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
    /** Optional recipe context to show VoiceAssistantButton next to title */
    recipeContext?: RecipeContext;
    /** Flag to indicate custom recipe without image */
    isCustomRecipe?: boolean;
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
    recipeContext,
    isCustomRecipe = false,
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
                <View
                    className="w-full"
                    style={{ paddingTop: insets.top }}
                >
                    <View className="w-full h-[120px] lg:h-[250px]">
                        <Image
                            source={{ uri: pictureUrl }}
                            className="w-full h-full"
                            contentFit="cover"
                            transition={300}
                            cachePolicy="memory-disk"
                        />
                        <LinearGradient
                            colors={[
                                'transparent',
                                'rgba(252, 246, 242, 0.1)',
                                'rgba(252, 246, 242, 0.3)',
                                'rgba(252, 246, 242, 0.5)',
                                'rgba(252, 246, 242, 0.7)',
                                'rgba(252, 246, 242, 0.9)',
                                '#FCF6F2' // COLORS.background.SECONDARY
                            ]}
                            locations={[0, 0.2, 0.4, 0.6, 0.8, 0.9, 1]}
                            className="absolute bottom-0 left-0 right-0 h-[70px] lg:h-[140px]"
                        />
                        <View
                            className="absolute left-md right-md lg:left-lg lg:right-lg flex-row justify-between items-center z-1"
                            style={{
                                top: isLarge ? 16 : 10,
                            }}
                        >
                            {showBackButton && (
                                <BackButton onPress={onBackPress} className="bg-white/60" />
                            )}
                            {isWebMobile && <HamburgerMenu style={{ marginLeft: 'auto' }} />}
                        </View>
                    </View>
                </View>
            )}

            <View className="px-sm mt-md mb-xxs lg:mb-sm lg:max-w-[1000px] lg:self-center lg:w-full">
                {!showImage && showBackButton && <BackButton onPress={onBackPress} className="mb-sm bg-black/5" />}

                {/* Title row with optional VoiceAssistantButton */}
                {showTitle && title !== undefined ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1, flexShrink: 1, marginRight: recipeContext ? 12 : 0 }}>
                            <Text preset={titlePreset} className="mb-xxs">
                                {title}
                            </Text>
                        </View>
                        {recipeContext && (
                            <VoiceAssistantButton
                                position="inline"
                                size="medium"
                                recipeContext={recipeContext}
                            />
                        )}
                    </View>
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
