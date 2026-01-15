import type { VoiceAssistantProvider } from './types';
import { OpenAIRealtimeProvider } from './providers/OpenAIRealtimeProvider';
import { HearThinkSpeakProvider } from './providers/HearThinkSpeakProvider';

export type ProviderType = 'openai-realtime' | 'hear-think-speak' | 'gemini-live';

export class VoiceProviderFactory {
    static create(type: ProviderType = 'hear-think-speak'): VoiceAssistantProvider {
        // Create a fresh instance each time (no singleton - allows proper cleanup/restart)
        switch (type) {
            case 'openai-realtime':
                return new OpenAIRealtimeProvider();

            case 'hear-think-speak':
                return new HearThinkSpeakProvider();

            case 'gemini-live':
                throw new Error('Gemini Live provider not yet implemented');

            default:
                throw new Error(`Unknown provider type: ${type}`);
        }
    }
}
