import type { VoiceAssistantProvider } from './types';
import { OpenAIRealtimeProvider } from './providers/OpenAIRealtimeProvider';

export type ProviderType = 'openai-realtime' | 'deepgram-pipeline' | 'gemini-live';

export class VoiceProviderFactory {
    private static instance: VoiceAssistantProvider | null = null;

    static create(type: ProviderType = 'openai-realtime'): VoiceAssistantProvider {
        // Singleton pattern - reuse existing instance
        if (this.instance) {
            return this.instance;
        }

        switch (type) {
            case 'openai-realtime':
                this.instance = new OpenAIRealtimeProvider();
                break;

            // Future providers (stubs for now)
            case 'deepgram-pipeline':
                throw new Error('Deepgram pipeline provider not yet implemented');

            case 'gemini-live':
                throw new Error('Gemini Live provider not yet implemented');

            default:
                throw new Error(`Unknown provider type: ${type}`);
        }

        return this.instance;
    }

    static async destroy(): Promise<void> {
        if (this.instance) {
            await this.instance.destroy();
            this.instance = null;
        }
    }
}
