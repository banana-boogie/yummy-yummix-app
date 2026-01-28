/**
 * Reusable header component for cooking guide pages.
 * Displays title (and optional subtitle) with VoiceAssistantButton inline.
 */
import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/common/Text';
import { VoiceAssistantButton } from '@/components/common/VoiceAssistantButton';
import type { RecipeContext } from '@/services/voice/types';

interface CookingGuidePageHeaderProps {
    title: string;
    subtitle?: string;
    recipeContext: RecipeContext;
}

export function CookingGuidePageHeader({
    title,
    subtitle,
    recipeContext,
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
                <VoiceAssistantButton
                    position="inline"
                    size="medium"
                    recipeContext={recipeContext}
                />
            </View>
        </View>
    );
}
