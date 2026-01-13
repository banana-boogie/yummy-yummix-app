/**
 * useVoiceRecording Hook
 *
 * Handles audio recording with expo-audio.
 * Provides start/stop recording functionality and permission management.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
    useAudioRecorder,
    RecordingPresets,
    requestRecordingPermissionsAsync,
    getRecordingPermissionsAsync,
    setAudioModeAsync,
} from 'expo-audio';

export interface UseVoiceRecordingReturn {
    isRecording: boolean;
    hasPermission: boolean;
    isVADEnabled: boolean;
    startRecording: (enableVAD?: boolean) => Promise<void>;
    stopRecording: () => Promise<string | null>;
    requestPermission: () => Promise<boolean>;
}

// VAD Configuration
const VAD_CONFIG = {
    silenceThreshold: -40, // dB level to consider as silence
    silenceDuration: 1500, // ms of silence before auto-stop
    minRecordingDuration: 500, // ms minimum recording time
};

export function useVoiceRecording(): UseVoiceRecordingReturn {
    const [hasPermission, setHasPermission] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isVADEnabled, setIsVADEnabled] = useState(false);
    const isPrepared = useRef(false);
    const vadTimerRef = useRef<NodeJS.Timeout | null>(null);
    const silenceStartRef = useRef<number | null>(null);
    const recordingStartRef = useRef<number>(0);

    const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, (status) => {
        // Update recording state based on status updates
        if (status.isFinished) {
            setIsRecording(false);
            setIsVADEnabled(false);
            if (vadTimerRef.current) {
                clearInterval(vadTimerRef.current);
                vadTimerRef.current = null;
            }
        }

        // VAD: Monitor audio metering during recording
        if (isVADEnabled && status.isRecording && status.metering !== undefined) {
            const currentTime = Date.now();
            const recordingDuration = currentTime - recordingStartRef.current;

            // Only apply VAD after minimum recording duration
            if (recordingDuration < VAD_CONFIG.minRecordingDuration) {
                return;
            }

            // Check if current audio level indicates silence
            if (status.metering < VAD_CONFIG.silenceThreshold) {
                if (silenceStartRef.current === null) {
                    silenceStartRef.current = currentTime;
                } else {
                    const silenceDuration = currentTime - silenceStartRef.current;
                    if (silenceDuration >= VAD_CONFIG.silenceDuration) {
                        console.log('VAD: Silence detected, auto-stopping');
                        // Auto-stop recording due to silence
                        stopRecording();
                    }
                }
            } else {
                // Reset silence timer if audio detected
                silenceStartRef.current = null;
            }
        }
    });

    // Check permissions on mount
    useEffect(() => {
        const checkPermission = async () => {
            const { granted } = await getRecordingPermissionsAsync();
            setHasPermission(granted);
        };
        checkPermission();
    }, []);

    const requestPermission = useCallback(async (): Promise<boolean> => {
        const { granted } = await requestRecordingPermissionsAsync();
        setHasPermission(granted);
        return granted;
    }, []);

    const startRecording = useCallback(async (enableVAD = false) => {
        try {
            // Ensure we have permission
            if (!hasPermission) {
                const granted = await requestPermission();
                if (!granted) {
                    throw new Error('Microphone permission not granted');
                }
            }

            // Configure audio mode for recording
            await setAudioModeAsync({
                allowsRecording: true,
                playsInSilentMode: true,
            });

            // Prepare the recorder if not already prepared
            if (!isPrepared.current) {
                await recorder.prepareToRecordAsync();
                isPrepared.current = true;
            }

            // Reset VAD state
            recordingStartRef.current = Date.now();
            silenceStartRef.current = null;
            setIsVADEnabled(enableVAD);

            // Start recording
            recorder.record();
            setIsRecording(true);

            console.log('Recording started', enableVAD ? 'with VAD' : 'manual mode');
        } catch (error) {
            console.error('Failed to start recording:', error);
            setIsRecording(false);
            setIsVADEnabled(false);
            throw error;
        }
    }, [recorder, hasPermission, requestPermission]);

    const stopRecording = useCallback(async (): Promise<string | null> => {
        try {
            if (!isRecording) {
                console.log('Not currently recording');
                return null;
            }

            // Stop the recording and wait for it to finish
            await recorder.stop();
            setIsRecording(false);
            setIsVADEnabled(false);
            isPrepared.current = false;

            // Clear VAD timers
            if (vadTimerRef.current) {
                clearInterval(vadTimerRef.current);
                vadTimerRef.current = null;
            }
            silenceStartRef.current = null;

            // Get the URI of the recorded file
            const uri = recorder.uri;
            console.log('Recording stopped, URI:', uri);

            // Reset audio mode
            await setAudioModeAsync({
                allowsRecording: false,
            });

            return uri;
        } catch (error) {
            console.error('Failed to stop recording:', error);
            setIsRecording(false);
            setIsVADEnabled(false);
            isPrepared.current = false;
            throw error;
        }
    }, [recorder, isRecording]);

    return {
        isRecording,
        hasPermission,
        isVADEnabled,
        startRecording,
        stopRecording,
        requestPermission,
    };
}
