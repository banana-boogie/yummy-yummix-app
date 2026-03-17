/**
 * Reusable header component for cooking guide pages.
 * Displays title (and optional subtitle) with an Irmixy avatar button inline.
 */
import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/common/Text';
import i18n from '@/i18n';

interface CookingGuidePageHeaderProps {
    title: string;
    subtitle?: string;
    onIrmixyPress: () => void;
}

export function CookingGuidePageHeader({
    title,
    subtitle,
    onIrmixyPress,
}: CookingGuidePageHeaderProps) {
    return (
        <View className="px-md mb-sm">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, flexShrink: 1, marginRight: 12 }}>
                    {title ? (
                        <Text preset="h1" className="text-text-default">
                            {title}
                        </Text>
                    ) : null}
                    {subtitle && (
                        <Text preset="subheading" className="text-text-secondary">
                            {subtitle}
                        </Text>
                    )}
                </View>
                <TouchableOpacity
                    onPress={onIrmixyPress}
                    accessibilityLabel={i18n.t('recipes.cookingGuide.navigation.askIrmixy')}
                    accessibilityRole="button"
                    activeOpacity={0.7}
                >
                    <Image
                        source={require('@/assets/images/irmixy-avatar/irmixy-face.png')}
                        style={{ width: 40, height: 40, borderRadius: 20 }}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
}
