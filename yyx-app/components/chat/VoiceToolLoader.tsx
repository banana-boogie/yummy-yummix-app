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
import { View, Animated, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/common/Text';
import { COLORS } from '@/constants/design-tokens';
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
        <View style={styles.container}>
            <Animated.View style={{ opacity: pulseAnim }}>
                <Image
                    source={require('@/assets/images/irmixy-avatar/irmixy-cooking.png')}
                    style={styles.avatar}
                    contentFit="contain"
                />
            </Animated.View>
            <View style={styles.textContainer}>
                <Text style={styles.message}>{message}</Text>
                <View style={styles.dotsRow}>
                    <Animated.View style={[styles.dot, { opacity: dot1 }]} />
                    <Animated.View style={[styles.dot, { opacity: dot2 }]} />
                    <Animated.View style={[styles.dot, { opacity: dot3 }]} />
                </View>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary.lightest,
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 20,
        marginHorizontal: 16,
        marginVertical: 8,
        gap: 14,
    },
    avatar: {
        width: 48,
        height: 48,
    },
    textContainer: {
        flex: 1,
        gap: 6,
    },
    message: {
        fontSize: 15,
        color: COLORS.text.default,
        fontWeight: '500',
    },
    dotsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.primary.darkest,
    },
});
