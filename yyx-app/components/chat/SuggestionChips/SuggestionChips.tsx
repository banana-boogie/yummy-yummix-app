import React, { memo } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
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
        <View className="mt-xs mb-sm">
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
            >
                {suggestions.map((suggestion, index) => {
                    const isRecipeGeneration = suggestion.type === 'recipe_generation';

                    return (
                        <TouchableOpacity
                            key={`${suggestion.label}-${index}`}
                            onPress={() => onPress(suggestion)}
                            activeOpacity={0.7}
                            className={
                                isRecipeGeneration
                                    ? 'flex-row items-center bg-primary-medium px-lg py-sm rounded-round shadow-sm'
                                    : 'flex-row items-center bg-primary-lightest px-lg py-sm rounded-round border border-border-default'
                            }
                            style={{ minHeight: 44 }}
                        >
                            {isRecipeGeneration && (
                                <MaterialCommunityIcons
                                    name="chef-hat"
                                    size={18}
                                    color={COLORS.neutral.white}
                                    style={{ marginRight: 6 }}
                                />
                            )}
                            <Text
                                className={
                                    isRecipeGeneration
                                        ? 'text-base text-white font-subheading'
                                        : 'text-base text-text-default font-body'
                                }
                                style={{ fontSize: 16 }}
                            >
                                {suggestion.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
});
