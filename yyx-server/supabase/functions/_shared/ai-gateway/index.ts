/**
 * AI Gateway - Main Entry Point
 * 
 * Unified interface for making AI requests.
 * ALL operations are routed through this gateway, which uses
 * the router to determine the appropriate provider and model.
 * 
 * To switch providers:
 * 1. Modify router.ts default config, OR
 * 2. Set environment variables: AI_TEXT_MODEL, AI_TRANSCRIPTION_MODEL, AI_TTS_MODEL
 */

import {
    AICompletionRequest,
    AICompletionResponse,
    AITranscriptionRequest,
    AITranscriptionResponse,
    AITextToSpeechRequest,
    AITextToSpeechResponse,
} from './types.ts';
import { getProviderConfig } from './router.ts';
import {
    callOpenAI,
    callOpenAIStream,
    transcribeOpenAI,
    textToSpeechOpenAI
} from './providers/openai.ts';

/**
 * Make an AI chat request.
 * Routes to the appropriate provider based on usageType.
 */
export async function chat(
    request: AICompletionRequest
): Promise<AICompletionResponse> {
    const config = getProviderConfig(request.usageType);
    const model = request.model ?? config.model;
    const apiKey = Deno.env.get(config.apiKeyEnvVar);

    if (!apiKey) {
        throw new Error(`Missing API key: ${config.apiKeyEnvVar}`);
    }

    switch (config.provider) {
        case 'openai':
            return callOpenAI(request, model, apiKey);

        case 'anthropic':
            throw new Error('Anthropic provider not yet implemented');

        case 'google':
            throw new Error('Google provider not yet implemented');

        default:
            throw new Error(`Unknown provider: ${config.provider}`);
    }
}

/**
 * Make an AI chat request with streaming.
 * Returns an async generator that yields content chunks.
 */
export async function* chatStream(
    request: AICompletionRequest
): AsyncGenerator<string, void, unknown> {
    const config = getProviderConfig(request.usageType);
    const model = request.model ?? config.model;
    const apiKey = Deno.env.get(config.apiKeyEnvVar);

    if (!apiKey) {
        throw new Error(`Missing API key: ${config.apiKeyEnvVar}`);
    }

    switch (config.provider) {
        case 'openai':
            yield* callOpenAIStream(request, model, apiKey);
            break;

        case 'anthropic':
            throw new Error('Anthropic streaming not yet implemented');

        case 'google':
            throw new Error('Google streaming not yet implemented');

        default:
            throw new Error(`Unknown provider: ${config.provider}`);
    }
}

/**
 * Transcribe audio to text.
 * Routes to the appropriate provider based on 'transcription' usage type.
 */
export async function transcribe(
    request: AITranscriptionRequest
): Promise<AITranscriptionResponse> {
    const config = getProviderConfig('transcription');
    const model = request.model ?? config.model;
    const apiKey = Deno.env.get(config.apiKeyEnvVar);

    if (!apiKey) {
        throw new Error(`Missing API key: ${config.apiKeyEnvVar}`);
    }

    switch (config.provider) {
        case 'openai':
            return transcribeOpenAI(request, model, apiKey);

        case 'cartesia': {
            const { transcribeCartesia } = await import('./providers/cartesia.ts');
            return transcribeCartesia(request, model, apiKey);
        }

        case 'anthropic':
            throw new Error('Anthropic does not support transcription');

        case 'google':
            throw new Error('Google transcription not yet implemented');

        default:
            throw new Error(`Unknown provider: ${config.provider}`);
    }
}

/**
 * Convert text to speech.
 * Routes to the appropriate provider based on 'tts' usage type.
 */
export async function textToSpeech(
    request: AITextToSpeechRequest
): Promise<AITextToSpeechResponse> {
    const config = getProviderConfig('tts');
    const model = request.model ?? config.model;
    const apiKey = Deno.env.get(config.apiKeyEnvVar);

    if (!apiKey) {
        throw new Error(`Missing API key: ${config.apiKeyEnvVar}`);
    }

    switch (config.provider) {
        case 'openai':
            return textToSpeechOpenAI(request, model, apiKey);

        case 'cartesia': {
            const { textToSpeechCartesia } = await import('./providers/cartesia.ts');
            return textToSpeechCartesia(request, model, apiKey);
        }

        case 'anthropic':
            throw new Error('Anthropic does not support TTS');

        case 'google':
            throw new Error('Google TTS not yet implemented');

        default:
            throw new Error(`Unknown provider: ${config.provider}`);
    }
}

// Re-export types for convenience
export * from './types.ts';
export { getProviderConfig, getAvailableUsageTypes } from './router.ts';
