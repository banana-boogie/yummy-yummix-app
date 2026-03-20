import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/common';
import i18n from '@/i18n';
import * as Haptics from 'expo-haptics';

export const SENTIMENT_TAG_KEYS = [
    'easyToFollow',
    'delicious',
    'quickToMake',
    'needsMoreSeasoning',
    'tooHard',
    'greatForFamily',
    'wouldMakeAgain',
] as const;

export type SentimentTagKey = typeof SENTIMENT_TAG_KEYS[number];

interface SentimentTagsProps {
    selected: SentimentTagKey[];
    onChange: (tags: SentimentTagKey[]) => void;
    disabled?: boolean;
}

export function SentimentTags({ selected, onChange, disabled = false }: SentimentTagsProps) {
    const handleToggle = async (key: SentimentTagKey) => {
        if (disabled) return;
        await Haptics.selectionAsync();
        if (selected.includes(key)) {
            onChange(selected.filter(t => t !== key));
        } else {
            onChange([...selected, key]);
        }
    };

    return (
        <View className="flex-row flex-wrap gap-xs">
            {SENTIMENT_TAG_KEYS.map((key) => {
                const isSelected = selected.includes(key);
                return (
                    <TouchableOpacity
                        key={key}
                        onPress={() => handleToggle(key)}
                        disabled={disabled}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={i18n.t(`recipes.rating.sentimentTags.${key}`)}
                        className={`px-sm py-xs rounded-lg border ${
                            isSelected
                                ? 'bg-primary-medium border-primary-medium'
                                : 'bg-background-secondary border-border-default'
                        } ${disabled ? 'opacity-50' : ''}`}
                    >
                        <Text
                            preset="bodySmall"
                            className={isSelected ? 'text-white' : 'text-text-default'}
                        >
                            {i18n.t(`recipes.rating.sentimentTags.${key}`)}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}
