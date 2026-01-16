/**
 * Voice Provider Factory
 * 
 * Creates voice assistant provider instances.
 * Currently only supports OpenAI Realtime.
 * 
 * Historical note: Gemini Live and HearThinkSpeak providers were
 * archived in git tag 'archive/voice-providers-experimental'
 */

import type { VoiceAssistantProvider } from './types';
import { OpenAIRealtimeProvider } from './providers/OpenAIRealtimeProvider';

export type ProviderType = 'openai-realtime';

export class VoiceProviderFactory {
    static create(type: ProviderType = 'openai-realtime'): VoiceAssistantProvider {
        switch (type) {
            case 'openai-realtime':
                return new OpenAIRealtimeProvider();

            default:
                throw new Error(`Unknown provider type: ${type}`);
        }
    }
}
