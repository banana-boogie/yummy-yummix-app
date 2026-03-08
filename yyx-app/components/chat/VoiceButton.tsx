/**
 * VoiceButton Component
 * 
 * Tap-to-toggle microphone button for voice recording.
 * Uses pure NativeWind for styling.
 */

import React from 'react';
import { TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type ButtonState = 'ready' | 'recording' | 'processing';

interface Props {
    state: ButtonState;
    onPress: () => void;
    size?: number;
    disabled?: boolean;
    accessibilityLabel?: string;
    accessibilityHint?: string;
}

export function VoiceButton({
    state,
    onPress,
    size = 72,
    disabled = false,
    accessibilityLabel,
    accessibilityHint,
}: Props) {
    const iconSize = size * 0.5;

    const getBackgroundClass = () => {
        switch (state) {
            case 'recording':
                return 'bg-primary-darkest';
            case 'processing':
                return 'bg-grey-medium';
            default:
                return 'bg-primary-default';
        }
    };

    const getIcon = () => {
        switch (state) {
            case 'recording':
                return 'stop';
            case 'processing':
                return 'microphone';
            default:
                return 'microphone';
        }
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || state === 'processing'}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={accessibilityHint}
            className={`items-center justify-center shadow-lg ${getBackgroundClass()}`}
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
            }}
        >
            {state === 'processing' ? (
                <ActivityIndicator size="large" color="#FFFFFF" />
            ) : (
                <View className="relative items-center justify-center">
                    <MaterialCommunityIcons
                        name={getIcon()}
                        size={iconSize}
                        color="#FFFFFF"
                    />
                    {state === 'recording' && (
                        <View className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-status-error" />
                    )}
                </View>
            )}
        </TouchableOpacity>
    );
}
