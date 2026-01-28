/**
 * useVoiceRecording Hook
 *
 * Handles microphone permissions and audio recording using expo-av.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';

export interface UseVoiceRecordingReturn {
  isRecording: boolean;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
}

export function useVoiceRecording(): UseVoiceRecordingReturn {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    Audio.getPermissionsAsync()
      .then(({ status }) => {
        setHasPermission(status === 'granted');
      })
      .catch(() => {
        setHasPermission(false);
      });
  }, []);

  const requestPermission = useCallback(async () => {
    const { status } = await Audio.requestPermissionsAsync();
    const granted = status === 'granted';
    setHasPermission(granted);
    return granted;
  }, []);

  const startRecording = useCallback(async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        throw new Error('Microphone permission not granted');
      }
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
    } catch (error) {
      recordingRef.current = null;
      setIsRecording(false);
      throw error;
    }
  }, [hasPermission, requestPermission]);

  const stopRecording = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return null;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      return uri ?? null;
    } catch (error) {
      recordingRef.current = null;
      setIsRecording(false);
      throw error;
    }
  }, []);

  return {
    isRecording,
    hasPermission,
    requestPermission,
    startRecording,
    stopRecording,
  };
}
