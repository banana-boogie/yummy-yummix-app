/**
 * RecipeProgressTracker
 *
 * A "Domino's tracker" style progress component for recipe generation.
 * Shows 6 named stages with animated transitions that tell the story of
 * Irmixy crafting a recipe.
 *
 * Two operating modes:
 * - SSE-driven (text chat): receives currentStatus prop with SSE anchors
 * - Timer-only (voice chat): no currentStatus, pure time-based animation
 *
 * The tracker advances through stages using a combination of SSE status events
 * and timer-based animation. Progress within each stage uses logarithmic easing
 * to feel natural.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Text } from '@/components/common/Text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import type { IrmixyStatus } from '@/types/irmixy';
import i18n from '@/i18n';

// ============================================================
// Configuration
// ============================================================

/**
 * Recipe progress tracker timing configuration.
 *
 * Adjust these values as recipe generation speed improves.
 * Each stage's durationMs controls how long the timer-based animation
 * spends on that stage before advancing to the next.
 * Total expected time ~ sum of all durationMs values.
 *
 * Current baseline: ~45s total (measured Feb 2026)
 */
export const PROGRESS_CONFIG = {
    stages: [
        { key: 'understanding', icon: 'lightbulb-outline' as const, i18nKey: 'chat.progressTracker.stage1', durationMs: 2000 },
        { key: 'ingredients', icon: 'basket-outline' as const, i18nKey: 'chat.progressTracker.stage2', durationMs: 10000 },
        { key: 'cookingTimes', icon: 'timer-outline' as const, i18nKey: 'chat.progressTracker.stage3', durationMs: 10000 },
        { key: 'steps', icon: 'clipboard-text-outline' as const, i18nKey: 'chat.progressTracker.stage4', durationMs: 13000 },
        { key: 'finalTouches', icon: 'star-four-points-outline' as const, i18nKey: 'chat.progressTracker.stage5', durationMs: 10000 },
        { key: 'ready', icon: 'check-circle-outline' as const, i18nKey: 'chat.progressTracker.stage6', durationMs: 0 },
    ],
    /** SSE status -> minimum stage index mappings */
    sseAnchors: {
        generating: 1, // snap to at least stage index 1 (ingredients)
        enriching: 4, // snap to at least stage index 4 (final touches)
    } as Record<string, number>,
    /** Progress cap within each stage (prevents stall-at-100% before anchor) */
    progressCap: 0.92,
    /** Show "Almost there..." after this many ms without completion */
    stallThresholdMs: 50000,
    /** Timer tick interval in ms */
    tickMs: 100,
} as const;

// ============================================================
// Types
// ============================================================

interface RecipeProgressTrackerProps {
    /** Real SSE status (text chat only). When absent, timer-only mode. */
    currentStatus?: IrmixyStatus;
    /** Whether the tracker is running */
    isActive: boolean;
    /** Recipe data has arrived (triggers completion) */
    hasRecipe: boolean;
}

// ============================================================
// Component
// ============================================================

export const RecipeProgressTracker = React.memo(function RecipeProgressTracker({
    currentStatus,
    isActive,
    hasRecipe,
}: RecipeProgressTrackerProps) {
    const { stages, sseAnchors, progressCap, stallThresholdMs, tickMs } = PROGRESS_CONFIG;

    // Internal state refs (managed via interval, not React state, to avoid excessive re-renders)
    const stageIndexRef = useRef(0);
    const stageElapsedRef = useRef(0);
    const totalElapsedRef = useRef(0);
    const isCompleteRef = useRef(false);
    const isStallRef = useRef(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Animated values
    const progressAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const labelOpacity = useRef(new Animated.Value(1)).current;
    const stallOpacity = useRef(new Animated.Value(0)).current;

    // Track the displayed stage index (for React state-driven re-renders of icons/label)
    const [displayStageIndex, setDisplayStageIndex] = React.useState(0);
    const [showStall, setShowStall] = React.useState(false);

    // Pulse animation for active icon
    const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);

    useEffect(() => {
        if (isActive && !isCompleteRef.current) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 0.4,
                        duration: 1200,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1200,
                        useNativeDriver: true,
                    }),
                ])
            );
            pulseAnimRef.current = pulse;
            pulse.start();
            return () => {
                pulse.stop();
                pulseAnimRef.current = null;
            };
        } else {
            pulseAnim.setValue(1);
        }
    }, [isActive, displayStageIndex, pulseAnim]);

    // Advance to a new stage with label crossfade
    const advanceToStage = React.useCallback((newIndex: number) => {
        if (newIndex <= stageIndexRef.current) return;
        if (newIndex >= stages.length) return;

        stageIndexRef.current = newIndex;
        stageElapsedRef.current = 0;

        // Crossfade label
        Animated.sequence([
            Animated.timing(labelOpacity, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(labelOpacity, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start();

        setDisplayStageIndex(newIndex);
    }, [stages.length, labelOpacity]);

    // Handle completion
    const completeTracker = React.useCallback(() => {
        if (isCompleteRef.current) return;
        isCompleteRef.current = true;

        // Advance to final stage
        advanceToStage(stages.length - 1);

        // Set progress to full
        Animated.timing(progressAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();

        // Stop pulse
        pulseAnimRef.current?.stop();
        pulseAnim.setValue(1);

        // Stop interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, [advanceToStage, stages.length, progressAnim, pulseAnim]);

    // React to hasRecipe
    useEffect(() => {
        if (hasRecipe && isActive) {
            completeTracker();
        }
    }, [hasRecipe, isActive, completeTracker]);

    // React to SSE status changes (text chat mode)
    useEffect(() => {
        if (!currentStatus || !isActive || isCompleteRef.current) return;

        const anchorIndex = sseAnchors[currentStatus];
        if (anchorIndex !== undefined && anchorIndex > stageIndexRef.current) {
            advanceToStage(anchorIndex);
        }
    }, [currentStatus, isActive, sseAnchors, advanceToStage]);

    // Main timer tick
    useEffect(() => {
        if (!isActive) {
            // Reset when deactivated
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        // Reset state when starting
        stageIndexRef.current = 0;
        stageElapsedRef.current = 0;
        totalElapsedRef.current = 0;
        isCompleteRef.current = false;
        isStallRef.current = false;
        progressAnim.setValue(0);
        setDisplayStageIndex(0);
        setShowStall(false);
        stallOpacity.setValue(0);

        intervalRef.current = setInterval(() => {
            if (isCompleteRef.current) return;

            stageElapsedRef.current += tickMs;
            totalElapsedRef.current += tickMs;

            const currentStageIdx = stageIndexRef.current;
            const stage = stages[currentStageIdx];

            // Timer-based stage advancement (skip the last stage — it's completion-only)
            if (stage.durationMs > 0 && stageElapsedRef.current >= stage.durationMs) {
                const nextIdx = currentStageIdx + 1;
                // Don't auto-advance to the last stage (ready) — that's hasRecipe-driven
                if (nextIdx < stages.length - 1) {
                    advanceToStage(nextIdx);
                }
            }

            // Calculate progress
            const totalDuration = stages.reduce((sum, s) => sum + s.durationMs, 0) || 1;
            const elapsedBeforeCurrentStage = stages
                .slice(0, currentStageIdx)
                .reduce((sum, s) => sum + s.durationMs, 0);
            const currentStageDuration = stage.durationMs || 1;

            // Logarithmic easing within stage: progress = 1 - 1/(1 + t*k)
            const t = stageElapsedRef.current / currentStageDuration;
            const k = 3; // easing factor
            const stageProgress = Math.min(1 - (1 / (1 + t * k)), progressCap);

            const overallProgress = (elapsedBeforeCurrentStage + stageProgress * currentStageDuration) / totalDuration;

            Animated.timing(progressAnim, {
                toValue: Math.min(overallProgress, progressCap),
                duration: tickMs,
                useNativeDriver: true,
            }).start();

            // Stall detection
            if (totalElapsedRef.current >= stallThresholdMs && !isStallRef.current) {
                isStallRef.current = true;
                setShowStall(true);
                Animated.timing(stallOpacity, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }).start();
            }
        }, tickMs);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    // isActive is the only trigger for starting/stopping the timer
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive]);

    // Memoize the stage icons row
    const stageIcons = useMemo(() => {
        return stages.map((stage, idx) => {
            const isCompleted = idx < displayStageIndex;
            const isActiveStage = idx === displayStageIndex;
            const isReady = stage.key === 'ready';

            return (
                <React.Fragment key={stage.key}>
                    {/* Connector line (between icons) */}
                    {idx > 0 && (
                        <View
                            style={[
                                styles.connector,
                                isCompleted || isActiveStage
                                    ? styles.connectorCompleted
                                    : styles.connectorFuture,
                            ]}
                        />
                    )}

                    {/* Stage icon */}
                    <View style={styles.stageIconWrapper}>
                        {isActiveStage && !isReady ? (
                            <Animated.View style={{ opacity: pulseAnim }}>
                                <View style={[styles.stageCircle, styles.stageCircleActive]}>
                                    <MaterialCommunityIcons
                                        name={stage.icon}
                                        size={18}
                                        color={COLORS.primary.darkest}
                                    />
                                </View>
                            </Animated.View>
                        ) : isCompleted || (isActiveStage && isReady) ? (
                            <View style={[styles.stageCircle, styles.stageCircleCompleted]}>
                                <MaterialCommunityIcons
                                    name={isReady ? 'check-circle-outline' : 'check'}
                                    size={isReady ? 18 : 14}
                                    color={COLORS.neutral.white}
                                />
                            </View>
                        ) : (
                            <View style={[styles.stageCircle, styles.stageCircleFuture]}>
                                <MaterialCommunityIcons
                                    name={stage.icon}
                                    size={18}
                                    color={COLORS.grey.medium}
                                />
                            </View>
                        )}
                    </View>
                </React.Fragment>
            );
        });
    }, [displayStageIndex, stages, pulseAnim]);

    if (!isActive && !isCompleteRef.current) return null;

    const currentStage = stages[displayStageIndex];

    return (
        <View
            style={styles.container}
            accessibilityRole="progressbar"
            accessibilityLabel={i18n.t(currentStage.i18nKey)}
        >
            {/* Stage icons row */}
            <View style={styles.stageRow}>
                {stageIcons}
            </View>

            {/* Current stage label */}
            <Animated.View style={[styles.labelContainer, { opacity: labelOpacity }]}>
                <Text style={styles.label}>
                    {i18n.t(currentStage.i18nKey)}
                </Text>
            </Animated.View>

            {/* Progress bar */}
            <View style={styles.progressBarTrack}>
                <Animated.View
                    style={[
                        styles.progressBarFill,
                        {
                            transform: [{ scaleX: progressAnim }],
                        },
                    ]}
                />
            </View>

            {/* Stall message */}
            {showStall && (
                <Animated.View style={[styles.stallContainer, { opacity: stallOpacity }]}>
                    <Text style={styles.stallText}>
                        {i18n.t('chat.progressTracker.stall')}
                    </Text>
                </Animated.View>
            )}
        </View>
    );
});

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.primary.lightest,
        borderRadius: 16,
        padding: 20,
        marginTop: 8,
    },
    stageRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        paddingHorizontal: 8,
    },
    stageIconWrapper: {
        alignItems: 'center',
    },
    stageCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stageCircleActive: {
        backgroundColor: COLORS.primary.default,
        borderWidth: 2,
        borderColor: COLORS.primary.darkest,
    },
    stageCircleCompleted: {
        backgroundColor: COLORS.status.success,
    },
    stageCircleFuture: {
        backgroundColor: COLORS.grey.default,
    },
    connector: {
        height: 2,
        flex: 1,
        marginHorizontal: 4,
    },
    connectorCompleted: {
        backgroundColor: COLORS.status.success,
    },
    connectorFuture: {
        backgroundColor: COLORS.grey.default,
    },
    labelContainer: {
        alignItems: 'center',
        marginBottom: 14,
        minHeight: 22,
    },
    label: {
        fontSize: 16,
        lineHeight: 22,
        color: COLORS.text.default,
        textAlign: 'center',
    },
    progressBarTrack: {
        height: 4,
        backgroundColor: COLORS.grey.default,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: COLORS.primary.darkest,
        borderRadius: 2,
        // transformOrigin: 'left' is set via style below
        // Using scaleX from 0-1 for native driver compatibility
        transformOrigin: 'left',
    },
    stallContainer: {
        alignItems: 'center',
        marginTop: 10,
    },
    stallText: {
        fontSize: 14,
        color: COLORS.text.secondary,
        fontStyle: 'italic',
    },
});
