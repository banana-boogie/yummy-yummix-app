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
}: CookingGuideHeaderProps) {
    const { isLarge, isWeb, isPhone } = useDevice();
    const isWebMobile = isWeb && isPhone;
    const insets = useSafeAreaInsets();

    return (
        <View className={className} style={style}>
            <StatusBar barStyle="light-content" />
            {pictureUrl && (
                <View className="w-full h-[120px] lg:h-[250px]">
                    <Image
                        source={pictureUrl}
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
                            top: (isWebMobile ? 24 : insets.top || 16) + 30,
                            transform: [{ translateY: isLarge ? 0 : -20 }]
                        }}
                    >
                        {showBackButton && (
                            <BackButton onPress={onBackPress} className="bg-white/60" />
                        )}
                        {isWebMobile && <HamburgerMenu style={{ marginLeft: 'auto' }} />}
                    </View>
                </View>
            )}

            <View className="px-sm mt-md mb-xxs lg:mb-sm lg:max-w-[1000px] lg:self-center lg:w-full">
                {!pictureUrl && showBackButton && <BackButton onPress={onBackPress} className="mb-sm bg-black/5" />}

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
