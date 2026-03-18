import React, { useState, useEffect, useRef } from 'react';
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
import { SentimentTags } from './SentimentTags';
import type { SentimentTagKey } from './SentimentTags';
import { useRecipeRating } from '@/hooks/useRecipeRating';
import { COLORS } from '@/constants/design-tokens';
import * as Haptics from 'expo-haptics';
import i18n from '@/i18n';
import { RATING_REQUIRES_COMPLETION_ERROR } from '@/services/ratingService';
import { eventService } from '@/services/eventService';

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
    const [selectedTags, setSelectedTags] = useState<SentimentTagKey[]>([]);
    const [showFreeText, setShowFreeText] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const submittingRef = useRef(false);

    // Clear timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    // Initialize rating with existing value if user has already rated
    useEffect(() => {
        if (existingRating) {
            setRating(existingRating);
        }
    }, [existingRating]);

    // Track modal shown
    useEffect(() => {
        if (visible) {
            eventService.logRatingModalShown(recipeId, recipeName);
        }
    }, [visible, recipeId, recipeName]);

    const handleSubmit = async () => {
        if (submittingRef.current) return;
        if (rating === 0) {
            setError(i18n.t('recipes.rating.pleaseSelectRating'));
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            return;
        }

        setError(null);
        submittingRef.current = true;

        try {
            // Submit rating
            await submitRatingAsync(rating);

            // Build combined feedback: tags + free text
            const tagLabels = selectedTags.map(key =>
                i18n.t(`recipes.rating.sentimentTags.${key}`)
            );
            const parts = [
                ...(tagLabels.length > 0 ? [`[${tagLabels.join(', ')}]`] : []),
                ...(feedback.trim() ? [feedback.trim()] : []),
            ];
            if (parts.length > 0) {
                await submitFeedbackAsync(parts.join(' '));
            }

            // Track and show success
            eventService.logRatingSubmitted(
                recipeId, recipeName, rating,
                feedback.trim().length > 0, selectedTags.length > 0, 'modal',
            );
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setShowSuccess(true);

            // Auto-close after showing success
            timeoutRef.current = setTimeout(() => {
                submittingRef.current = false;
                setShowSuccess(false);
                setRating(0);
                setFeedback('');
                setSelectedTags([]);
                setShowFreeText(false);
                onClose();
            }, 1500);
        } catch (err) {
            submittingRef.current = false;
            const errorMessage = err instanceof Error && err.message === RATING_REQUIRES_COMPLETION_ERROR
                ? i18n.t('recipes.rating.completeRecipeToRate')
                : i18n.t('recipes.rating.submitError');
            setError(errorMessage);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    const handleSkip = async () => {
        eventService.logRatingSkipped(recipeId, recipeName);
        await Haptics.selectionAsync();
        setRating(0);
        setFeedback('');
        setSelectedTags([]);
        setShowFreeText(false);
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

                            {/* Sentiment Tags */}
                            <View className="mb-md">
                                <Text preset="bodySmall" className="text-text-secondary mb-xs">
                                    {i18n.t('recipes.rating.feedbackLabel')}
                                </Text>
                                <SentimentTags
                                    selected={selectedTags}
                                    onChange={setSelectedTags}
                                    disabled={isSubmitting}
                                />
                            </View>

                            {/* Expandable Free Text */}
                            {showFreeText ? (
                                <View className="mb-lg">
                                    <TextInput
                                        value={feedback}
                                        onChangeText={setFeedback}
                                        placeholder={i18n.t('recipes.rating.feedbackPlaceholder')}
                                        placeholderTextColor={COLORS.grey.medium}
                                        multiline
                                        numberOfLines={3}
                                        maxLength={2000}
                                        editable={!isSubmitting}
                                        className="bg-background-secondary rounded-lg p-md text-text-default font-body text-sm"
                                        style={{
                                            minHeight: 80,
                                            textAlignVertical: 'top',
                                        }}
                                    />
                                </View>
                            ) : (
                                <TouchableOpacity
                                    onPress={() => setShowFreeText(true)}
                                    disabled={isSubmitting}
                                    className="mb-lg"
                                >
                                    <Text preset="bodySmall" className="text-primary-darkest underline">
                                        {i18n.t('recipes.rating.addComment')}
                                    </Text>
                                </TouchableOpacity>
                            )}

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
