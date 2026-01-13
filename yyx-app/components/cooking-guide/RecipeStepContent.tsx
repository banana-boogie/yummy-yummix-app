import React, { useState } from 'react';
import { View, StyleProp, ViewStyle, Pressable } from 'react-native';
import { Text } from "@/components/common/Text";
import { renderRecipeText } from "@/components/recipe-detail/RenderRecipeText";
import { MessageBubble } from '@/components/cooking-guide/MessageBubble';
import { ThermomixCookingParameters } from '@/components/cooking-guide/ThermomixCookingParameters';
import { RecipeStep } from '@/types/recipe.types';
import { Image } from 'expo-image';
import { getIngredientName } from '@/utils/recipes/ingredients';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import * as Haptics from 'expo-haptics';

interface RecipeStepContentProps {
    step: RecipeStep;
    className?: string;
    style?: StyleProp<ViewStyle>;
}

export function RecipeStepContent({ step, className = '', style }: RecipeStepContentProps) {
    const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());

    const handleIngredientPress = (ingredientId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCheckedIngredients(prev => {
            const newSet = new Set(prev);
            if (newSet.has(ingredientId)) {
                newSet.delete(ingredientId);
            } else {
                newSet.add(ingredientId);
            }
            return newSet;
        });
    };

    const renderIngredientImages = () => {
        if (!step?.ingredients) return null;

        return (
            <View className="flex-row justify-center items-center flex-wrap gap-lg lg:gap-xl my-sm">
                {step.ingredients.map((ingredient) => {
                    if (!ingredient?.pictureUrl) return null;

                    const isChecked = checkedIngredients.has(ingredient.id);

                    return (
                        <Pressable
                            key={ingredient.id}
                            className="items-center"
                            onPress={() => handleIngredientPress(ingredient.id)}
                            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                        >
                            <View
                                className="mb-[2px] relative"
                                style={{ opacity: isChecked ? 0.4 : 1 }}
                            >
                                {/* Subtle tap hint ring */}
                                <View
                                    className="absolute inset-0 rounded-[30px] border-2 border-dashed"
                                    style={{
                                        borderColor: isChecked ? COLORS.status.success : COLORS.primary.medium,
                                        opacity: 0.5
                                    }}
                                />
                                <Image
                                    source={ingredient.pictureUrl}
                                    className="w-[70px] h-[70px] lg:w-[100px] lg:h-[100px] rounded-[30px]"
                                    contentFit="contain"
                                    cachePolicy="memory-disk"
                                    transition={300}
                                />
                                {/* Checkmark overlay when checked */}
                                {isChecked && (
                                    <View className="absolute inset-0 items-center justify-center">
                                        <View className="bg-status-success rounded-full p-xs">
                                            <Ionicons name="checkmark" size={24} color={COLORS.neutral.white} />
                                        </View>
                                    </View>
                                )}
                            </View>
                            <View
                                className="flex-row justify-center items-baseline gap-xs"
                                style={{ opacity: isChecked ? 0.5 : 1 }}
                            >
                                <Text preset="handwritten" className="text-[18px]">
                                    {ingredient.formattedQuantity}
                                </Text>
                                <Text preset="handwritten" className="text-[16px]">
                                    {ingredient.formattedUnit}
                                </Text>
                            </View>
                            <Text
                                preset="handwritten"
                                className="text-[14px] text-grey-medium_dark text-center"
                                style={{ opacity: isChecked ? 0.5 : 1 }}
                            >
                                {getIngredientName(ingredient)}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        );
    };

    return (
        <MessageBubble
            className={className}
            style={style}
            contentContainerClassName="py-lg justify-center"
        >
            {renderRecipeText(step.instruction, {
                textStyle: { textAlign: 'center', fontSize: 24, lineHeight: 32, marginBottom: 16, paddingHorizontal: 8 },
                boldStyle: { color: '#FF9A99', fontSize: 24, lineHeight: 32 },
                bulletStyle: { marginBottom: 4, paddingLeft: 24, textAlign: 'left' }
            }, step.ingredients)}
            {renderIngredientImages()}
            {step.thermomix ? (
                <ThermomixCookingParameters
                    time={step.thermomix?.time}
                    temperature={step.thermomix?.temperature}
                    temperatureUnit={step.thermomix?.temperatureUnit}
                    isBladeReversed={step.thermomix?.isBladeReversed}
                    speed={step.thermomix?.speed}
                    className="mt-[-4px]"
                />
            ) : null}
        </MessageBubble>
    );
}