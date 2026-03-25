/**
 * RestTimer Component
 *
 * Detects "let sit/rest/cool/stand" instructions in recipe steps,
 * extracts the duration, and offers a countdown timer.
 * Centered card-style design with large timer text for kitchen visibility.
 * Fires local notification with system sound on completion alongside haptic feedback.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/common/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import * as Haptics from 'expo-haptics';
import notificationService from '@/services/notifications/NotificationService';
import i18n from '@/i18n';

interface RestTimerProps {
    instruction: string;
    /** Explicit duration in seconds — bypasses keyword detection when provided. */
    durationSeconds?: number | null;
}

// Rest/wait keywords in English and Spanish
const REST_KEYWORDS = [
    'let sit', 'let rest', 'let cool', 'let stand', 'set aside',
    'allow to rest', 'allow to cool', 'rest for', 'cool for', 'stand for',
    'wait for', 'let it sit', 'let it rest', 'let it cool',
    'dejar reposar', 'dejar enfriar', 'dejar descansar', 'dejar asentar',
    'reposar por', 'enfriar por', 'descansar por', 'esperar',
];

// Patterns to extract time: "5 minutes", "30 min", "1 hour", "2 horas", etc.
const TIME_PATTERNS = [
    /(\d+)\s*(?:minutes?|mins?|minutos?)/i,
    /(\d+)\s*(?:hours?|hrs?|horas?)/i,
    /(\d+)\s*(?:seconds?|secs?|segundos?)/i,
];

/**
 * Detect rest instruction and extract duration in seconds.
 * Returns null if no rest detected or no time found.
 */
export function detectRestTime(instruction: string): number | null {
    const lower = instruction.toLowerCase();

    const hasRestKeyword = REST_KEYWORDS.some(kw => lower.includes(kw));
    if (!hasRestKeyword) return null;

    for (const pattern of TIME_PATTERNS) {
        const match = lower.match(pattern);
        if (match) {
            const value = parseInt(match[1], 10);
            if (pattern.source.includes('hour')) return value * 3600;
            if (pattern.source.includes('second')) return value;
            return value * 60; // minutes
        }
    }

    return null;
}

function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Fire a local notification with system sound when the timer finishes.
 *  Works in foreground and background — banner + sound even with phone locked. */
async function fireTimerNotification(): Promise<void> {
    await notificationService.fireTimerNotification(
        i18n.t('recipes.cookingGuide.timerDone'),
    );
}

export function RestTimer({ instruction, durationSeconds }: RestTimerProps) {
    const totalSeconds = durationSeconds ?? detectRestTime(instruction);
    const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds ?? 0);
    const [isRunning, setIsRunning] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Reset when instruction or explicit duration changes
    useEffect(() => {
        const newTotal = durationSeconds ?? detectRestTime(instruction);
        setRemainingSeconds(newTotal ?? 0);
        setIsRunning(false);
        setIsComplete(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, [instruction, durationSeconds]);

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
            fireTimerNotification();
        }
    }, [remainingSeconds, isRunning]);

    const handleStartPause = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (isComplete) {
            // Reset
            setRemainingSeconds(totalSeconds ?? 0);
            setIsComplete(false);
            setIsRunning(false);
        } else {
            setIsRunning(prev => !prev);
        }
    }, [isComplete, totalSeconds]);

    if (!totalSeconds) return null;

    return (
        <View className="bg-primary-lightest rounded-xl p-lg items-center w-full shadow-sm mt-md">
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
                className="bg-primary-medium rounded-full px-xl py-sm mt-sm"
                style={{ minWidth: 120, minHeight: 44 }}
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
