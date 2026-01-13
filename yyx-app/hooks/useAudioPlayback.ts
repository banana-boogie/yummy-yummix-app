/**
 * useAudioPlayback Hook
 *
 * Handles audio playback with expo-audio (replacing deprecated expo-av).
 * Supports playing from URI or base64 data.
 */

import { useState, useCallback, useEffect } from 'react';
import { useAudioPlayer, AudioSource, setAudioModeAsync } from 'expo-audio';

export interface UseAudioPlaybackReturn {
    isPlaying: boolean;
    isLoading: boolean;
    play: (uri: string) => Promise<void>;
    stop: () => void;
}

export function useAudioPlayback(): UseAudioPlaybackReturn {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const player = useAudioPlayer(null);

    const stop = useCallback(() => {
        try {
            player.pause();
            player.seekTo(0);
            setIsPlaying(false);
        } catch (error) {
            console.warn('Error stopping audio:', error);
        }
    }, [player]);

    const play = useCallback(async (uri: string) => {
        try {
            // Stop any currently playing audio
            stop();

            setIsLoading(true);

            // Configure audio to play through speaker (not earpiece)
            await setAudioModeAsync({
                playsInSilentMode: true,
            });

            // Replace the audio source
            player.replace({ uri } as AudioSource);

            // Play
            player.play();
            setIsPlaying(true);
            setIsLoading(false);

            console.log('Playing audio');
        } catch (error) {
            console.error('Failed to play audio:', error);
            setIsLoading(false);
            setIsPlaying(false);
            throw error;
        }
    }, [player, stop]);

    // Listen for playback status changes
    player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
            setIsPlaying(false);
        }
    });

    return {
        isPlaying,
        isLoading,
        play,
        stop,
    };
}
