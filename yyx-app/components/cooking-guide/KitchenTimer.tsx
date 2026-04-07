/**
 * KitchenTimer Component
 *
 * Renders a countdown timer for recipe steps that have an explicit timerSeconds value.
 * Centered card-style design with large timer text for kitchen visibility.
 *
 * Notification strategy:
 * - On start: schedules a future notification so it fires even when backgrounded.
 * - On pause/reset/unmount: cancels the scheduled notification.
 * - On completion (foreground): fires an immediate notification for in-app banner + haptic.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/common/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import * as Haptics from 'expo-haptics';
import notificationService from '@/services/notifications/NotificationService';
import i18n from '@/i18n';

interface KitchenTimerProps {
    /** Explicit duration in seconds. Timer only renders when this is provided. */
    durationSeconds?: number | null;
}

function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function KitchenTimer({ durationSeconds }: KitchenTimerProps) {
    const totalSeconds = durationSeconds ?? null;
    const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds ?? 0);
    const [isRunning, setIsRunning] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const scheduledNotificationRef = useRef<string | null>(null);

    /** Cancel any pending scheduled notification. */
    const cancelScheduledNotification = useCallback(async () => {
        if (scheduledNotificationRef.current) {
            await notificationService.cancelNotification(scheduledNotificationRef.current);
            scheduledNotificationRef.current = null;
        }
    }, []);

    /** Schedule a notification for `seconds` from now. */
    const scheduleNotification = useCallback(async (seconds: number) => {
        await cancelScheduledNotification();
        if (seconds > 0) {
            const id = await notificationService.scheduleTimerNotification(
                i18n.t('recipes.cookingGuide.timerDone'),
                seconds,
            );
            scheduledNotificationRef.current = id;
        }
    }, [cancelScheduledNotification]);

    // Reset when duration changes
    useEffect(() => {
        setRemainingSeconds(durationSeconds ?? 0);
        setIsRunning(false);
        setIsComplete(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        cancelScheduledNotification();
    }, [durationSeconds, cancelScheduledNotification]);

    // Cancel notification on unmount
    useEffect(() => {
        return () => {
            cancelScheduledNotification();
        };
    }, [cancelScheduledNotification]);

    useEffect(() => {
        if (!isRunning) return;

        intervalRef.current = setInterval(() => {
            setRemainingSeconds(prev => (prev <= 1 ? 0 : prev - 1));
        }, 1000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isRunning]);

    // Completion handler — separate from the interval to avoid race conditions
    useEffect(() => {
        if (isRunning && remainingSeconds === 0) {
            setIsRunning(false);
            setIsComplete(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Cancel the scheduled background notification before firing an immediate one
            // to prevent double-notification when the timer completes in the foreground.
            cancelScheduledNotification();
            notificationService.fireTimerNotification(
                i18n.t('recipes.cookingGuide.timerDone'),
            );
        }
    }, [remainingSeconds, isRunning, cancelScheduledNotification]);

    const handleStartPause = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (isComplete) {
            // Reset
            setRemainingSeconds(totalSeconds ?? 0);
            setIsComplete(false);
            setIsRunning(false);
            cancelScheduledNotification();
        } else if (isRunning) {
            // Pause — cancel the scheduled notification
            setIsRunning(false);
            cancelScheduledNotification();
        } else {
            // Start — schedule notification for remaining duration
            setIsRunning(true);
            scheduleNotification(remainingSeconds);
        }
    }, [isComplete, isRunning, totalSeconds, remainingSeconds, cancelScheduledNotification, scheduleNotification]);

    if (!totalSeconds) return null;

    return (
        <View className="bg-primary-lightest rounded-xl p-lg items-center w-full shadow-sm mt-md">
            <Text preset="caption" className="text-text-secondary mb-xs">
                {i18n.t('recipes.cookingGuide.kitchenTimer')}
            </Text>
            <Ionicons
                name={isComplete ? 'checkmark-circle' : 'timer-outline'}
                size={32}
                color={isComplete ? COLORS.status.success : COLORS.primary.medium}
            />
            <Text
                className={`font-subheading font-light mt-xs text-5xl ${isComplete ? 'text-status-success' : 'text-text-default'}`}
            >
                {isComplete
                    ? i18n.t('recipes.cookingGuide.timerDone')
                    : formatTime(remainingSeconds)
                }
            </Text>
            <Pressable
                onPress={handleStartPause}
                className="bg-primary-medium rounded-full px-xl py-sm mt-sm min-w-[120px] min-h-[44px]"
            >
                <Text preset="body" className="text-white font-semibold text-center">
                    {isComplete
                        ? i18n.t('recipes.cookingGuide.timerReset')
                        : isRunning
                            ? i18n.t('recipes.cookingGuide.timerPause')
                            : i18n.t('recipes.cookingGuide.timerStart')
                    }
                </Text>
            </Pressable>
        </View>
    );
}
