/**
 * AudioLevelIndicator Component
 * 
 * Visual indicator showing current audio input level and silence countdown.
 * Changes color based on speaking detection and shows progress toward auto-stop.
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Text } from '@/components/common/Text';
import i18n from '@/i18n';

interface Props {
    audioLevel: number;        // 0-1 normalized audio level
    silenceProgress: number;   // 0-1 progress toward auto-stop
    isSpeaking: boolean;       // whether speech is detected
    isActive: boolean;         // whether recording is active
}

export function AudioLevelIndicator({
    audioLevel,
    silenceProgress,
    isSpeaking,
    isActive
}: Props) {
    const levelAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Animate audio level bar
    useEffect(() => {
        Animated.timing(levelAnim, {
            toValue: audioLevel,
            duration: 50,
            useNativeDriver: false,
        }).start();
    }, [audioLevel, levelAnim]);

    // Pulse animation when speaking
    useEffect(() => {
        if (isActive && isSpeaking) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.1,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            pulseAnim.stopAnimation();
            pulseAnim.setValue(1);
        }
    }, [isActive, isSpeaking, pulseAnim]);

    if (!isActive) {
        return null;
    }

    const barColor = isSpeaking ? '#22C55E' : '#6B7280'; // green when speaking, gray when silent
    const silenceColor = silenceProgress > 0.5 ? '#F59E0B' : '#6B7280'; // orange when close to auto-stop

    return (
        <Animated.View
            style={[
                styles.container,
                { transform: [{ scale: pulseAnim }] }
            ]}
        >
            {/* Audio level bar */}
            <View style={styles.levelBarContainer}>
                <Animated.View
                    style={[
                        styles.levelBar,
                        {
                            backgroundColor: barColor,
                            width: levelAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['5%', '100%'],
                            }),
                        }
                    ]}
                />
            </View>

            {/* Status text */}
            <View style={styles.statusContainer}>
                {isSpeaking ? (
                    <View style={styles.statusRow}>
                        <View style={[styles.statusDot, { backgroundColor: '#22C55E' }]} />
                        <Text preset="caption" style={styles.statusText}>
                            {i18n.t('chat.voice.hearing')}
                        </Text>
                    </View>
                ) : silenceProgress > 0 ? (
                    <View style={styles.statusRow}>
                        <View style={[styles.statusDot, { backgroundColor: silenceColor }]} />
                        <Text preset="caption" style={[styles.statusText, { color: silenceColor }]}>
                            {i18n.t('chat.voice.silenceDetected')} ({Math.round(silenceProgress * 100)}%)
                        </Text>
                    </View>
                ) : (
                    <Text preset="caption" style={styles.statusText}>
                        {i18n.t('chat.voice.waitingForSpeech')}
                    </Text>
                )}
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    levelBarContainer: {
        width: '80%',
        height: 8,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        overflow: 'hidden',
    },
    levelBar: {
        height: '100%',
        borderRadius: 4,
        minWidth: 4,
    },
    statusContainer: {
        marginTop: 8,
        alignItems: 'center',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    statusText: {
        color: '#6B7280',
    },
});
