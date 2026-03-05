/**
 * VoiceToolLoader
 *
 * Warm, branded loading indicator shown while Irmixy executes a tool
 * (recipe search, modification, etc.). Replaces the generic ActivityIndicator
 * with something our audience will appreciate.
 *
 * Features:
 * - Irmixy cooking avatar with gentle pulse
 * - Tool-specific friendly message
 * - Animated typing dots
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/common/Text';
import i18n from '@/i18n';

interface VoiceToolLoaderProps {
    toolName: string | null;
}

const TOOL_I18N: Record<string, string> = {
    search_recipes: 'chat.voice.searchingRecipes',
    generate_custom_recipe: 'chat.voice.generatingRecipe',
    modify_recipe: 'chat.voice.modifyingRecipe',
    retrieve_cooked_recipes: 'chat.voice.retrievingRecipes',
};

export const VoiceToolLoader = React.memo(function VoiceToolLoader({
    toolName,
}: VoiceToolLoaderProps) {
    const dot1 = useRef(new Animated.Value(0.3)).current;
    const dot2 = useRef(new Animated.Value(0.3)).current;
    const dot3 = useRef(new Animated.Value(0.3)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Staggered dot animation
    useEffect(() => {
        const createDotAnim = (dot: Animated.Value, delay: number) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
                    Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
                ]),
            );

        const anim1 = createDotAnim(dot1, 0);
        const anim2 = createDotAnim(dot2, 200);
        const anim3 = createDotAnim(dot3, 400);

        anim1.start();
        anim2.start();
        anim3.start();

        return () => {
            anim1.stop();
            anim2.stop();
            anim3.stop();
        };
    }, [dot1, dot2, dot3]);

    // Gentle avatar pulse
    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 0.85, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ]),
        );
        pulse.start();
        return () => pulse.stop();
    }, [pulseAnim]);

    const i18nKey = (toolName && TOOL_I18N[toolName]) || 'chat.voice.executingTool';
    const message = i18n.t(i18nKey);

    return (
        <View className="flex-row items-center bg-primary-lightest rounded-lg py-md px-lg mx-md my-xs gap-sm">
            <Animated.View style={{ opacity: pulseAnim }}>
                <Image
                    source={require('@/assets/images/irmixy-avatar/irmixy-cooking.png')}
                    className="w-xxl h-xxl"
                    contentFit="contain"
                />
            </Animated.View>
            <View className="flex-1 gap-xxs">
                <Text className="text-[15px] text-text-default font-medium">{message}</Text>
                <View className="flex-row gap-xxs">
                    <Animated.View className="w-xs h-xs rounded-xs bg-primary-darkest" style={{ opacity: dot1 }} />
                    <Animated.View className="w-xs h-xs rounded-xs bg-primary-darkest" style={{ opacity: dot2 }} />
                    <Animated.View className="w-xs h-xs rounded-xs bg-primary-darkest" style={{ opacity: dot3 }} />
                </View>
            </View>
        </View>
    );
});
