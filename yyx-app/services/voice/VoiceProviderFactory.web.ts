/**
 * Web Voice Provider Factory
 *
 * Metro automatically uses this file on web builds instead of VoiceProviderFactory.ts
 * The `.web.ts` extension tells Metro to use this implementation for web platform only.
 *
 * Returns WebVoiceProvider (stub) since voice chat requires native WebRTC on mobile.
 * Native platforms (iOS/Android) continue using the native factory.
 */

import type { VoiceAssistantProvider } from './types';
import { WebVoiceProvider } from './providers/WebVoiceProvider';

export type ProviderType = 'openai-realtime';

export class VoiceProviderFactory {
  static create(type: ProviderType = 'openai-realtime'): VoiceAssistantProvider {
    // On web, always return the stub provider regardless of type requested
    return new WebVoiceProvider();
  }
}
