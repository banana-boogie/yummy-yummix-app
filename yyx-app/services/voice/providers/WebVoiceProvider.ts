/**
 * Web Voice Provider - Stub Implementation
 *
 * This provider is used on web platform instead of OpenAIRealtimeProvider.
 * Voice chat requires native WebRTC features not available in browsers yet.
 *
 * When browser WebRTC support is ready, replace this stub with a real
 * implementation using navigator.mediaDevices and RTCPeerConnection.
 *
 * Metro automatically uses this file on web builds via the `.web.ts` extension.
 */

import type {
  VoiceAssistantProvider,
  VoiceStatus,
  VoiceEvent,
  ProviderConfig,
  ConversationContext,
  UserContext,
  RecipeContext,
  QuotaInfo,
} from '../types';
import i18n from '@/i18n';

const getMobileOnlyMessage = () => i18n.t('chat.voice.mobileOnly.message');
const getMobileOnlyHint = () => i18n.t('chat.voice.mobileOnly.hint');

export class WebVoiceProvider implements VoiceAssistantProvider {
  private status: VoiceStatus = 'idle';
  private eventListeners: Map<VoiceEvent, Set<Function>> = new Map();

  constructor() {
    console.warn(`[WebVoiceProvider] ${getMobileOnlyHint()}`);
  }

  async initialize(config: ProviderConfig): Promise<any> {
    this.setStatus('idle');
    console.warn(`[WebVoiceProvider] ${getMobileOnlyHint()}`);
    return null;
  }

  async startConversation(context: ConversationContext): Promise<void> {
    this.setStatus('error');
    this.emit('error', new Error(getMobileOnlyMessage()));
  }

  stopConversation(): void {
    this.setStatus('idle');
  }

  setContext(userContext: UserContext, recipeContext?: RecipeContext): void {
    // No-op on web
  }

  sendToolResult(callId: string, output: string): void {
    // No-op on web
  }

  on(event: VoiceEvent, callback: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: VoiceEvent, callback: (...args: any[]) => void): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  getStatus(): VoiceStatus {
    return this.status;
  }

  async getRemainingQuota(): Promise<QuotaInfo> {
    return {
      remainingMinutes: 0,
      minutesUsed: 0,
      quotaLimit: 0,
      warning: getMobileOnlyHint(),
    };
  }

  async destroy(): Promise<void> {
    this.eventListeners.clear();
    this.setStatus('idle');
  }

  // Private helpers
  private setStatus(status: VoiceStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.emit('statusChange', status);
    }
  }

  private emit(event: VoiceEvent, ...args: any[]): void {
    this.eventListeners.get(event)?.forEach((callback) => callback(...args));
  }
}
