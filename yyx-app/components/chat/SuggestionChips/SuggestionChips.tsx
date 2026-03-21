import React, { memo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '@/components/common/Text';
import type { Suggestion } from '@/types/irmixy';
import { COLORS } from '@/constants/design-tokens';

interface SuggestionChipsProps {
    suggestions: Suggestion[];
    onPress: (suggestion: Suggestion) => void;
}

export const SuggestionChips = memo(function SuggestionChips({
    suggestions,
    onPress,
}: SuggestionChipsProps) {
    if (!suggestions.length) return null;

    return (
        <View className="mt-sm mb-sm px-xs gap-sm">
            {suggestions.map((suggestion, index) => {
                const isRecipeGeneration = suggestion.type === 'recipe_generation';

                return (
                    <TouchableOpacity
                        key={`${suggestion.label}-${index}`}
                        onPress={() => onPress(suggestion)}
                        activeOpacity={0.7}
                        className={
                            isRecipeGeneration
                                ? 'flex-row items-center bg-primary-medium px-md py-md rounded-xl shadow-sm'
                                : 'flex-row items-center bg-primary-lightest px-md py-md rounded-xl border border-border-default'
                        }
                        style={{ minHeight: 52 }}
                    >
                        {isRecipeGeneration && (
                            <View className="w-9 h-9 rounded-full bg-white/20 items-center justify-center mr-sm">
                                <MaterialCommunityIcons
                                    name="chef-hat"
                                    size={20}
                                    color={COLORS.neutral.white}
                                />
                            </View>
                        )}
                        <Text
                            className={
                                isRecipeGeneration
                                    ? 'text-base text-white font-subheading flex-1'
                                    : 'text-base text-text-default font-body flex-1'
                            }
                            style={{ fontSize: 16 }}
                        >
                            {suggestion.label}
                        </Text>
                        <MaterialCommunityIcons
                            name="chevron-right"
                            size={20}
                            color={isRecipeGeneration ? COLORS.neutral.white : COLORS.text.secondary}
                            style={{ marginLeft: 8 }}
                        />
                    </TouchableOpacity>
                );
            })}
        </View>
    );
});
