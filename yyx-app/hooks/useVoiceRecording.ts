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
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<string | null>;
    requestPermission: () => Promise<boolean>;
}

export function useVoiceRecording(): UseVoiceRecordingReturn {
    const [hasPermission, setHasPermission] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const isPrepared = useRef(false);

    const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, (status) => {
        // Update recording state based on status updates
        if (status.isFinished) {
            setIsRecording(false);
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

    const startRecording = useCallback(async () => {
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

            // Start recording
            recorder.record();
            setIsRecording(true);

            console.log('Recording started');
        } catch (error) {
            console.error('Failed to start recording:', error);
            setIsRecording(false);
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
            isPrepared.current = false;

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
            isPrepared.current = false;
            throw error;
        }
    }, [recorder, isRecording]);

    return {
        isRecording,
        hasPermission,
        startRecording,
        stopRecording,
        requestPermission,
    };
}
