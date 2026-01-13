/**
 * Voice Service
 * 
 * Handles communication with the AI voice Edge Function.
 */

import { supabase } from '@/lib/supabase';
import i18n from '@/i18n';
import { Platform } from 'react-native';

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

    // Create form data with proper React Native file format
    const formData = new FormData();

    // React Native requires this specific format for file uploads
    formData.append('audio', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'recording.m4a',
    } as any);

    formData.append('language', language);
    if (sessionId) {
        formData.append('sessionId', sessionId);
    }

    console.log('Sending to:', AI_VOICE_URL);

    const response = await fetch(AI_VOICE_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${session.access_token}`,
            // Don't set Content-Type - FormData will set it with boundary
        },
        body: formData,
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
 * Convert base64 audio to a playable data URI.
 */
export function base64ToAudioUri(base64: string): string {
    const uri = `data:audio/mp3;base64,${base64}`;
    console.log('[Voice] Created audio URI, base64 length:', base64.length, 'total URI length:', uri.length);
    return uri;
}
