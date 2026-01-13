/**
 * useVoiceRecording Hook - With VAD
 *
 * Features:
 * - Speakerphone mode
 * - VAD with useAudioRecorderState for metering (may not work on all iOS devices)
 * - Falls back to manual stop if metering shows -120dB
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
    useAudioRecorder,
    useAudioRecorderState,
    RecordingPresets,
    requestRecordingPermissionsAsync,
    getRecordingPermissionsAsync,
    setAudioModeAsync,
} from 'expo-audio';

export interface UseVoiceRecordingReturn {
    isRecording: boolean;
    hasPermission: boolean;
    audioLevel: number;
    silenceProgress: number;
    isSpeaking: boolean;
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<string | null>;
    requestPermission: () => Promise<boolean>;
    onUtteranceComplete: React.MutableRefObject<((uri: string) => void) | null>;
}

const CONFIG = {
    silenceThresholdDb: -45,
    silenceDurationMs: 1500,
    minUtteranceDurationMs: 1000,
    dbMin: -60,
    dbMax: -10,
};

function normalizeDbToLevel(db: number | undefined): number {
    if (db === undefined || db === null || db < CONFIG.dbMin) return 0;
    if (db > CONFIG.dbMax) return 1;
    return (db - CONFIG.dbMin) / (CONFIG.dbMax - CONFIG.dbMin);
}

const RECORDING_OPTIONS = {
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
};

export function useVoiceRecording(): UseVoiceRecordingReturn {
    const [hasPermission, setHasPermission] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [silenceProgress, setSilenceProgress] = useState(0);

    const isRecordingRef = useRef(false);
    const isPreparedRef = useRef(false);
    const utteranceStartTimeRef = useRef(0);
    const silenceStartTimeRef = useRef<number | null>(null);
    const hasSpokenRef = useRef(false);
    const isStoppingRef = useRef(false);

    const onUtteranceComplete = useRef<((uri: string) => void) | null>(null);

    const recorder = useAudioRecorder(RECORDING_OPTIONS);
    const recorderState = useAudioRecorderState(recorder, 100);

    const meteringDb = recorderState.metering ?? -120;
    const audioLevel = normalizeDbToLevel(meteringDb);
    const isSpeaking = meteringDb > CONFIG.silenceThresholdDb;

    // Check if metering is working (not stuck at -120)
    const meteringWorking = meteringDb > -100;

    useEffect(() => {
        const checkPermission = async () => {
            const { granted } = await getRecordingPermissionsAsync();
            setHasPermission(granted);
        };
        checkPermission();
    }, []);

    // VAD logic
    useEffect(() => {
        if (!isRecordingRef.current || isStoppingRef.current || !meteringWorking) {
            return;
        }

        const now = Date.now();

        if (isSpeaking) {
            if (!hasSpokenRef.current) {
                console.log('[VAD] Speech detected!');
            }
            hasSpokenRef.current = true;
            silenceStartTimeRef.current = null;
            setSilenceProgress(0);
        }

        const recordingDuration = now - utteranceStartTimeRef.current;
        if (recordingDuration < CONFIG.minUtteranceDurationMs || !hasSpokenRef.current) {
            return;
        }

        if (!isSpeaking) {
            if (silenceStartTimeRef.current === null) {
                silenceStartTimeRef.current = now;
                console.log(`[VAD] Silence started at ${meteringDb.toFixed(1)} dB`);
            } else {
                const silenceDuration = now - silenceStartTimeRef.current;
                const progress = Math.min(1, silenceDuration / CONFIG.silenceDurationMs);
                setSilenceProgress(progress);

                if (silenceDuration >= CONFIG.silenceDurationMs) {
                    console.log('[VAD] Auto-stopping for silence');
                    isStoppingRef.current = true;

                    (async () => {
                        try {
                            isRecordingRef.current = false;
                            setIsRecording(false);
                            await recorder.stop();
                            isPreparedRef.current = false;

                            const uri = recorder.uri;
                            console.log('[VAD] Stopped, URI:', uri);

                            if (uri && onUtteranceComplete.current) {
                                onUtteranceComplete.current(uri);
                            }
                        } catch (error) {
                            console.error('[VAD] Stop error:', error);
                        } finally {
                            isStoppingRef.current = false;
                        }
                    })();
                }
            }
        }
    }, [isSpeaking, meteringDb, meteringWorking, recorder]);

    const requestPermission = useCallback(async (): Promise<boolean> => {
        const { granted } = await requestRecordingPermissionsAsync();
        setHasPermission(granted);
        return granted;
    }, []);

    const configureAudioMode = useCallback(async (forRecording: boolean) => {
        await setAudioModeAsync({
            allowsRecording: forRecording,
            playsInSilentMode: true,
            shouldRouteThroughEarpiece: false,
            interruptionMode: 'doNotMix',
        });
    }, []);

    const startRecording = useCallback(async () => {
        if (isRecordingRef.current) {
            console.log('[Recording] Already recording');
            return;
        }

        console.log('[Recording] Starting...');

        try {
            if (!hasPermission) {
                const granted = await requestPermission();
                if (!granted) {
                    throw new Error('Microphone permission required');
                }
            }

            await configureAudioMode(true);

            if (!isPreparedRef.current) {
                await recorder.prepareToRecordAsync({
                    ...RecordingPresets.HIGH_QUALITY,
                    isMeteringEnabled: true,
                });
                isPreparedRef.current = true;
            }

            utteranceStartTimeRef.current = Date.now();
            silenceStartTimeRef.current = null;
            hasSpokenRef.current = false;
            isStoppingRef.current = false;
            isRecordingRef.current = true;
            setIsRecording(true);
            setSilenceProgress(0);

            recorder.record();
            console.log('[Recording] Started!');
        } catch (error) {
            console.error('[Recording] Start error:', error);
            isRecordingRef.current = false;
            setIsRecording(false);
            throw error;
        }
    }, [hasPermission, requestPermission, configureAudioMode, recorder]);

    const stopRecording = useCallback(async (): Promise<string | null> => {
        if (!isRecordingRef.current) {
            console.log('[Recording] Not recording');
            return null;
        }

        console.log('[Recording] Stopping...');
        isRecordingRef.current = false;
        isStoppingRef.current = true;
        setIsRecording(false);

        try {
            await recorder.stop();
            isPreparedRef.current = false;
            const uri = recorder.uri;
            console.log('[Recording] Stopped, URI:', uri);

            await configureAudioMode(false);
            isStoppingRef.current = false;
            return uri;
        } catch (error) {
            console.error('[Recording] Stop error:', error);
            isPreparedRef.current = false;
            await configureAudioMode(false);
            isStoppingRef.current = false;
            return null;
        }
    }, [recorder, configureAudioMode]);

    return {
        isRecording,
        hasPermission,
        audioLevel,
        silenceProgress,
        isSpeaking,
        startRecording,
        stopRecording,
        requestPermission,
        onUtteranceComplete,
    };
}
