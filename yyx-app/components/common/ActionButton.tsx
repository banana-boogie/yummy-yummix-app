/**
 * ActionButton — Compact inline button for chat action triggers.
 *
 * Unlike the main Button component (pill-shaped, shadowed, large padding),
 * ActionButton is designed for inline use in chat messages: flat, compact,
 * rounded-lg, and self-start aligned.
 */

import React from 'react';
import { TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from './Text';

interface ActionButtonProps {
    label: string;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
    className?: string;
}

export function ActionButton({ label, onPress, loading, disabled, className }: ActionButtonProps) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            className={`self-start bg-primary-medium px-md py-xs rounded-lg active:opacity-85 ${
                disabled ? 'opacity-50' : ''
            } ${className ?? ''}`}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            {loading ? (
                <ActivityIndicator size="small" color="white" />
            ) : (
                <Text className="text-sm font-medium text-white">
                    {label}
                </Text>
            )}
        </TouchableOpacity>
    );
}
