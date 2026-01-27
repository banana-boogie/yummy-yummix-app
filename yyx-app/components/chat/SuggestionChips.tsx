/**
 * SuggestionChips Component
 * 
 * Displays horizontal scrollable suggestion chips for quick actions in chat.
 */

import React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/common/Text';
import type { SuggestionChip } from '@/types/irmixy';

interface SuggestionChipsProps {
    suggestions: SuggestionChip[];
    onSelect: (suggestion: SuggestionChip) => void;
    disabled?: boolean;
}

export function SuggestionChips({ suggestions, onSelect, disabled = false }: SuggestionChipsProps) {
    if (suggestions.length === 0) return null;

    return (
        <View className="py-sm">
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            >
                {suggestions.map((suggestion) => (
                    <TouchableOpacity
                        key={`${suggestion.label}:${suggestion.message}`}
                        onPress={() => onSelect(suggestion)}
                        disabled={disabled}
                        className={`px-md py-sm rounded-full border ${disabled
                                ? 'border-border-default bg-background-secondary'
                                : 'border-accent bg-accent/10'
                            }`}
                        activeOpacity={0.7}
                    >
                        <Text
                            className={`text-sm ${disabled ? 'text-text-tertiary' : 'text-accent'
                                }`}
                        >
                            {suggestion.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}
