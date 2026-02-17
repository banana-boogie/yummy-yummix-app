import { useState, useCallback, useRef, useEffect } from 'react';
import { Animated, Alert } from 'react-native';
import {
    ExpoSpeechRecognitionModule,
    useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import i18n from '@/i18n';

interface UseSpeechRecognitionOptions {
    language: 'en' | 'es';
    onTranscript: (text: string) => void;
}

interface UseSpeechRecognitionResult {
    isListening: boolean;
    pulseAnim: Animated.Value;
    handleMicPress: () => Promise<void>;
    /** Stop recognition and guard against late results (call on send). */
    stopAndGuard: () => void;
}

export function useSpeechRecognition({
    language,
    onTranscript,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionResult {
    const [isListening, setIsListening] = useState(false);
    const speechStoppedByUserRef = useRef(false);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Pulse animation while listening
    useEffect(() => {
        if (isListening) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isListening, pulseAnim]);

    // Speech recognition events
    useSpeechRecognitionEvent('result', (event) => {
        if (speechStoppedByUserRef.current) return;
        const transcript = event.results[0]?.transcript;
        if (transcript) {
            onTranscript(transcript);
        }
    });

    useSpeechRecognitionEvent('end', () => {
        setIsListening(false);
        // Don't reset speechStoppedByUserRef here — it guards against late
        // result events that would re-fill the input after send cleared it.
        // The ref is reset when the user starts a new dictation session.
    });

    useSpeechRecognitionEvent('error', (event) => {
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            Alert.alert(i18n.t('chat.voice.micPermissionDenied'));
        }
    });

    const handleMicPress = useCallback(async () => {
        try {
            if (isListening) {
                speechStoppedByUserRef.current = true;
                ExpoSpeechRecognitionModule.stop();
                setIsListening(false);
                return;
            }

            const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
            if (!granted) {
                Alert.alert(i18n.t('chat.voice.micPermissionDenied'));
                return;
            }

            speechStoppedByUserRef.current = false;
            setIsListening(true);
            ExpoSpeechRecognitionModule.start({
                lang: language === 'es' ? 'es-MX' : 'en-US',
                interimResults: true,
            });
        } catch (error) {
            setIsListening(false);
            if (__DEV__) {
                console.error('[useSpeechRecognition] Failed to start/stop recognition:', error);
            }
            Alert.alert(i18n.t('chat.error.default'));
        }
    }, [isListening, language]);

    const stopAndGuard = useCallback(() => {
        speechStoppedByUserRef.current = true;
        ExpoSpeechRecognitionModule.stop();
        setIsListening(false);
    }, []);

    return { isListening, pulseAnim, handleMicPress, stopAndGuard };
}
