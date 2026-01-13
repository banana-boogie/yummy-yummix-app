/**
 * AI Gateway - Cartesia Provider
 * 
 * Implementation for Cartesia's text-to-speech and speech-to-text APIs.
 * - TTS: Sonic-3 model for ultra-low latency (90ms)
 * - STT: Ink-Whisper model for real-time transcription
 */

import {
    AITextToSpeechRequest,
    AITextToSpeechResponse,
    AITranscriptionRequest,
    AITranscriptionResponse,
} from '../types.ts';

const CARTESIA_TTS_URL = 'https://api.cartesia.ai/tts/bytes';
const CARTESIA_STT_URL = 'https://api.cartesia.ai/stt/bytes';
const CARTESIA_API_VERSION = '2024-11-13';

// Voice IDs from Cartesia voice library
// Spanish Mexican: Warm, friendly female voice
const VOICE_SPANISH_MEXICAN = '2ddb0cea-61b0-4c24-a425-3e9dca4364ef'; // Sofía - Mexican Spanish female

// English: Cheerful, enthusiastic female voice matching Irmixy personality
const VOICE_ENGLISH = 'eda5bbff-1ff1-4886-8ef1-4e69a77640a0'; // Sophie - cheerful English female

interface CartesiaTTSRequest {
    model_id: string;
    transcript: string;
    voice: {
        mode: 'id';
        id: string;
    };
    output_format: {
        container: 'mp3' | 'wav' | 'raw';
        sample_rate: number;
    };
}

/**
 * Generate speech audio using Cartesia's TTS API (Sonic-3).
 */
export async function textToSpeechCartesia(
    request: AITextToSpeechRequest,
    model: string,
    apiKey: string
): Promise<AITextToSpeechResponse> {
    // Select voice based on language
    const isSpanish = request.language?.startsWith('es');
    const voiceId = request.voice || (isSpanish ? VOICE_SPANISH_MEXICAN : VOICE_ENGLISH);

    const cartesiaRequest: CartesiaTTSRequest = {
        model_id: model, // sonic-3 from router
        transcript: request.text,
        voice: {
            mode: 'id',
            id: voiceId,
        },
        output_format: {
            container: 'mp3',
            sample_rate: 44100,
        },
    };

    console.log('[Cartesia TTS] Request:', {
        model: model,
        textLength: request.text.length,
        voice: voiceId,
        language: request.language,
    });

    const response = await fetch(CARTESIA_TTS_URL, {
        method: 'POST',
        headers: {
            'X-API-Key': apiKey,
            'Cartesia-Version': CARTESIA_API_VERSION,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(cartesiaRequest),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error('[Cartesia TTS] Error:', response.status, errorBody);
        throw new Error(`Cartesia TTS API error (${response.status}): ${errorBody}`);
    }

    // Response is raw audio bytes
    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = btoa(
        String.fromCharCode(...new Uint8Array(audioBuffer))
    );

    console.log('[Cartesia TTS] Success, audio size:', audioBuffer.byteLength);

    return {
        audioBase64,
        format: 'mp3',
    };
}

/**
 * Transcribe audio using Cartesia's STT API (Ink-Whisper).
 */
export async function transcribeCartesia(
    request: AITranscriptionRequest,
    model: string,
    apiKey: string
): Promise<AITranscriptionResponse> {
    console.log('[Cartesia STT] Request:', {
        model: model,
        audioSize: request.audioData.byteLength,
        language: request.language,
    });

    // Create form data with audio file
    const formData = new FormData();
    const blob = new Blob([request.audioData], { type: 'audio/mp4' });
    formData.append('file', blob, 'audio.m4a');
    formData.append('model', model); // ink-whisper from router

    // Add language hint if provided
    if (request.language) {
        formData.append('language', request.language);
    }

    const response = await fetch(CARTESIA_STT_URL, {
        method: 'POST',
        headers: {
            'X-API-Key': apiKey,
            'Cartesia-Version': CARTESIA_API_VERSION,
        },
        body: formData,
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error('[Cartesia STT] Error:', response.status, errorBody);
        throw new Error(`Cartesia STT API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    console.log('[Cartesia STT] Success:', data.text?.substring(0, 50));

    return {
        text: data.text || '',
        language: data.language,
    };
}
