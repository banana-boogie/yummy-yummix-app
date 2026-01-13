import React, { useState, useEffect } from 'react';
import {
    View,
    Modal,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
} from 'react-native';
import { Text, Button } from '@/components/common';
import { StarRatingInput } from './StarRatingInput';
import { useRecipeRating } from '@/hooks/useRecipeRating';
import { COLORS } from '@/constants/design-tokens';
import * as Haptics from 'expo-haptics';
import i18n from '@/i18n';

interface RecipeRatingModalProps {
    visible: boolean;
    onClose: () => void;
    recipeId: string;
    recipeName: string;
}

/**
 * Modal shown after completing a recipe to collect rating and optional feedback
 */
export function RecipeRatingModal({
    visible,
    onClose,
    recipeId,
    recipeName,
}: RecipeRatingModalProps) {
    const {
        userRating: existingRating,
        submitRatingAsync,
        submitFeedbackAsync,
        isSubmittingRating,
        isSubmittingFeedback,
    } = useRecipeRating(recipeId);

    const [rating, setRating] = useState<number>(0);
    const [feedback, setFeedback] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize rating with existing value if user has already rated
    useEffect(() => {
        if (existingRating) {
            setRating(existingRating);
        }
    }, [existingRating]);

    const handleSubmit = async () => {
        if (rating === 0) {
            setError(i18n.t('recipes.rating.pleaseSelectRating'));
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            return;
        }

        setError(null);

        try {
            // Submit rating
            await submitRatingAsync(rating);

            // Submit feedback if provided
            if (feedback.trim()) {
                await submitFeedbackAsync(feedback.trim());
            }

            // Show success
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setShowSuccess(true);

            // Auto-close after showing success
            setTimeout(() => {
                setShowSuccess(false);
                setRating(0);
                setFeedback('');
                onClose();
            }, 1500);
        } catch (err) {
            setError(i18n.t('recipes.rating.submitError'));
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    const handleSkip = async () => {
        await Haptics.selectionAsync();
        setRating(0);
        setFeedback('');
        onClose();
    };

    const isSubmitting = isSubmittingRating || isSubmittingFeedback;

    if (showSuccess) {
        return (
            <Modal
                visible={visible}
                transparent
                animationType="fade"
                onRequestClose={onClose}
            >
                <View className="flex-1 justify-center items-center bg-black/60">
                    <View className="bg-white rounded-xl p-lg items-center mx-md">
                        <Text preset="h1" className="text-status-success mb-sm">✓</Text>
                        <Text preset="h3" className="text-center">
                            {i18n.t('recipes.rating.thankYou')}
                        </Text>
                    </View>
                </View>
            </Modal>
        );
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleSkip}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <TouchableOpacity
                    activeOpacity={1}
                    className="flex-1 justify-end bg-black/50"
                    onPress={() => Keyboard.dismiss()}
                >
                    <TouchableOpacity activeOpacity={1}>
                        <View className="bg-white rounded-t-2xl px-lg pt-lg pb-xl">
                            {/* Header */}
                            <View className="items-center mb-lg">
                                <Text preset="h2" className="text-center mb-xs">
                                    {i18n.t('recipes.rating.howWasIt')}
                                </Text>
                                <Text preset="body" className="text-text-secondary text-center">
                                    {recipeName}
                                </Text>
                            </View>

                            {/* Star Rating */}
                            <View className="items-center mb-lg">
                                <StarRatingInput
                                    value={rating}
                                    onChange={setRating}
                                    disabled={isSubmitting}
                                    size="lg"
                                />
                                {error && (
                                    <Text preset="caption" className="text-status-error mt-sm">
                                        {error}
                                    </Text>
                                )}
                            </View>

                            {/* Feedback Input */}
                            <View className="mb-lg">
                                <Text preset="bodySmall" className="text-text-secondary mb-xs">
                                    {i18n.t('recipes.rating.feedbackLabel')}
                                </Text>
                                <TextInput
                                    value={feedback}
                                    onChangeText={setFeedback}
                                    placeholder={i18n.t('recipes.rating.feedbackPlaceholder')}
                                    placeholderTextColor={COLORS.grey.medium}
                                    multiline
                                    numberOfLines={3}
                                    maxLength={2000}
                                    editable={!isSubmitting}
                                    className="bg-background-secondary rounded-lg p-md text-text-default"
                                    style={{
                                        minHeight: 80,
                                        textAlignVertical: 'top',
                                        fontFamily: 'Montserrat',
                                        fontSize: 14,
                                    }}
                                />
                            </View>

                            {/* Action Buttons */}
                            <View className="flex-row gap-md">
                                <View className="flex-1">
                                    <Button
                                        label={i18n.t('recipes.rating.skip')}
                                        onPress={handleSkip}
                                        variant="outline"
                                        fullWidth
                                        disabled={isSubmitting}
                                    />
                                </View>
                                <View className="flex-1">
                                    <Button
                                        label={isSubmitting ? '' : i18n.t('recipes.rating.submit')}
                                        onPress={handleSubmit}
                                        variant="primary"
                                        fullWidth
                                        disabled={isSubmitting || rating === 0}
                                        loading={isSubmitting}
                                    />
                                </View>
                            </View>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </Modal>
    );
}

export default RecipeRatingModal;
