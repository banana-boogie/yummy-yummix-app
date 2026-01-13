/**
 * Voice Service
 * 
 * Handles communication with the AI voice Edge Function.
 */

import { supabase } from '@/lib/supabase';
import i18n from '@/i18n';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

export interface VoiceResponse {
    transcription: string;
    response: string;
    audioBase64: string;
    sessionId: string;
}

const AI_VOICE_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-voice`;

/**
 * Send voice recording to AI and get spoken response.
 * 
 * @param audioUri - Local URI to the recorded audio file
 * @param sessionId - Optional session ID to continue a conversation
 * @returns VoiceResponse with transcription, text response, and audio
 */
export async function sendVoiceMessage(
    audioUri: string,
    sessionId: string | null
): Promise<VoiceResponse> {
    // Get current session token
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new Error('Not authenticated');
    }

    // Get current language from i18n
    const language = i18n.locale.startsWith('es') ? 'es' : 'en';

    // Read audio file as base64 - more reliable than FormData in React Native
    console.log('[Voice] Reading audio file:', audioUri);
    const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
    });
    console.log('[Voice] Audio base64 length:', audioBase64.length);

    console.log('[Voice] Sending to:', AI_VOICE_URL);
    console.log('[Voice] Language:', language);

    const response = await fetch(AI_VOICE_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            audioBase64,
            language,
            sessionId,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Voice API error:', response.status, errorText);
        let errorMessage = `HTTP ${response.status}`;
        try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorMessage;
        } catch { }
        throw new Error(errorMessage);
    }

    return response.json();
}

/**
 * Convert base64 audio to a playable file URI.
 * Writes to a temp file because expo-audio doesn't support data URIs.
 */
export async function base64ToAudioUri(base64: string): Promise<string> {
    const filename = `response_${Date.now()}.mp3`;
    const fileUri = `${FileSystem.cacheDirectory}${filename}`;

    console.log('[Voice] Writing audio to file:', fileUri, 'base64 length:', base64.length);

    await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
    });

    console.log('[Voice] Audio file written successfully');
    return fileUri;
}

