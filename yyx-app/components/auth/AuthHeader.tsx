import React from 'react';
import { View, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/common/Text';
import { BackButton } from '@/components/navigation/BackButton';
import { GradientHeader } from '../common';
import { ResponsiveLayout } from '@/components/layouts/ResponsiveLayout';

interface AuthHeaderProps {
    title: string;
    showBackButton?: boolean;
    className?: string;
    style?: StyleProp<ViewStyle>;
    titleStyle?: StyleProp<TextStyle>;
}

export function AuthHeader({ title, showBackButton = false, className = '', style }: AuthHeaderProps) {
    return (
        <GradientHeader contentClassName="min-h-[130px]" className={className} style={style}>
            <ResponsiveLayout>
                <View className="flex-row justify-between items-end flex-1">
                    {showBackButton && <BackButton className="pl-md" />}
                    <Text preset="h1" className="font-bold mx-lg text-text-default">
                        {title}
                    </Text>
                    <Image
                        source={require('@/assets/images/branding/yyx_logo_header_with_banner.png')}
                        className="w-[100px] h-[150px]"
                        contentFit="contain"
                        cachePolicy="memory-disk"
                    />
                </View>
            </ResponsiveLayout>
        </GradientHeader>
    );
}