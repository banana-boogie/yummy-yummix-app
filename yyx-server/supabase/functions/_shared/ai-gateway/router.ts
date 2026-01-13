/**
 * AI Gateway - Router
 * 
 * Routes AI requests to the appropriate provider/model based on usage type.
 */

import { AIRoutingConfig, AIUsageType, AIProviderConfig } from './types.ts';

/**
 * Default routing configuration.
 * Maps usage types to specific providers and models.
 * Can be overridden via environment variables.
 */
const defaultRoutingConfig: AIRoutingConfig = {
    // Chat completions
    text: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiKeyEnvVar: 'OPENAI_API_KEY',
    },
    // Voice-optimized chat (shorter responses)
    voice: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiKeyEnvVar: 'OPENAI_API_KEY',
    },
    // Structured data parsing
    parsing: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiKeyEnvVar: 'OPENAI_API_KEY',
    },
    // Complex reasoning tasks
    reasoning: {
        provider: 'openai',
        model: 'o1-mini',
        apiKeyEnvVar: 'OPENAI_API_KEY',
    },
    // Speech-to-text transcription (Cartesia Ink-Whisper for low latency)
    transcription: {
        provider: 'cartesia',
        model: 'ink-whisper',
        apiKeyEnvVar: 'CARTESIA_API_KEY',
    },
    // Text-to-speech generation (Cartesia Sonic-3 for ultra-low latency)
    tts: {
        provider: 'cartesia',
        model: 'sonic-3',
        apiKeyEnvVar: 'CARTESIA_API_KEY',
    },
};

/**
 * Get the provider configuration for a given usage type.
 * Checks for environment variable overrides first.
 * 
 * Override examples:
 * - AI_TEXT_MODEL=gpt-4o
 * - AI_TRANSCRIPTION_MODEL=whisper-large
 * - AI_TTS_MODEL=tts-1-hd
 */
export function getProviderConfig(usageType: AIUsageType): AIProviderConfig {
    const envOverride = Deno.env.get(`AI_${usageType.toUpperCase()}_MODEL`);

    const config = defaultRoutingConfig[usageType];

    if (envOverride) {
        return {
            ...config,
            model: envOverride,
        };
    }

    return config;
}

/**
 * Get all available usage types.
 */
export function getAvailableUsageTypes(): AIUsageType[] {
    return Object.keys(defaultRoutingConfig) as AIUsageType[];
}
