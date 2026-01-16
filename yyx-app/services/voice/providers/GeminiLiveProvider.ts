/**
 * Gemini Live Voice Provider
 * 
 * Implements VoiceAssistantProvider for Google's Gemini Live API.
 * Uses @google/genai SDK's live.connect() for proper ephemeral token auth.
 * 
 * Architecture:
 * 1. Backend mints ephemeral token via authTokens.create()
 * 2. Client uses SDK's live.connect() with token.name as apiKey
 * 3. Audio capture via react-native-live-audio-stream
 * 4. Audio playback via react-native-track-player
 */

import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';
import InCallManager from 'react-native-incall-manager';
import LiveAudioStream from 'react-native-live-audio-stream';
import TrackPlayer, { Capability, State } from 'react-native-track-player';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from '@google/genai';
import { buildSystemPrompt, detectGoodbye, InactivityTimer } from '../shared/VoiceUtils';
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

export class GeminiLiveProvider implements VoiceAssistantProvider {
    private session: Session | null = null;
    private status: VoiceStatus = 'idle';
    private sessionId: string | null = null;
    private sessionStartTime: number | null = null;
    private inactivityTimer = new InactivityTimer(30000); // 30 seconds
    private eventListeners: Map<VoiceEvent, Set<Function>> = new Map();
    private currentContext: ConversationContext | null = null;
    private isRecording = false;
    private isSetupComplete = false;
    private ephemeralToken: string | null = null;

    // Token tracking for cost calculation
    private sessionInputTokens: number = 0;
    private sessionOutputTokens: number = 0;

    constructor() {
        this.setupPlayer();
    }

    private async setupPlayer() {
        try {
            await TrackPlayer.setupPlayer();
            await TrackPlayer.updateOptions({
                capabilities: [Capability.Play, Capability.Stop],
                compactCapabilities: [Capability.Play, Capability.Stop],
            });
        } catch (e) {
            console.log('[Gemini] Player setup (ignore if already set up):', e);
        }
    }

    async initialize(config: ProviderConfig): Promise<any> {
        this.setStatus('connecting');

        try {
            // 1. Get ephemeral token from backend
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            console.log('[Gemini] Requesting ephemeral token...');
            const response = await fetch(
                `${process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL}/start-gemini-session`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to start Gemini session');
            }

            const data = await response.json();
            this.sessionId = data.sessionId;
            this.ephemeralToken = data.ephemeralToken;

            console.log('[Gemini] Token received:', this.ephemeralToken?.substring(0, 30) + '...');

            // 2. Initialize Google GenAI SDK with ephemeral token
            // The SDK's live.connect() handles the WebSocket auth internally
            const ai = new GoogleGenAI({
                apiKey: this.ephemeralToken!,
                httpOptions: { apiVersion: 'v1alpha' }
            });

            console.log('[Gemini] SDK initialized, establishing live connection...');

            this.setStatus('idle');
            return { ...data, ai };

        } catch (error) {
            console.error('[Gemini] Initialize error:', error);
            this.setStatus('error');
            this.emit('error', error);
            throw error;
        }
    }

    async startConversation(context: ConversationContext): Promise<void> {
        this.currentContext = context;
        this.setStatus('connecting');

        if (!this.ephemeralToken) {
            console.error('[Gemini] No ephemeral token - call initialize() first');
            return;
        }

        // Route audio to loudspeaker
        InCallManager.start({ media: 'audio', ringback: '' });
        InCallManager.setForceSpeakerphoneOn(true);
        console.log('[Gemini] Audio routed to loudspeaker');

        // Start inactivity timer
        this.inactivityTimer.reset(() => {
            console.log('[Gemini] Inactivity timeout, ending session');
            this.stopConversation();
        });

        try {
            // Initialize SDK with ephemeral token and connect
            const ai = new GoogleGenAI({
                apiKey: this.ephemeralToken,
                httpOptions: { apiVersion: 'v1alpha' }
            });

            const systemPrompt = buildSystemPrompt(context);

            console.log('[Gemini] Establishing live connection...');

            // Use SDK's live.connect() which handles auth properly
            // Model must include 'models/' prefix for v1alpha API
            this.session = await ai.live.connect({
                model: 'models/gemini-2.0-flash-exp',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: 'Aoede' }
                        }
                    },
                    systemInstruction: {
                        parts: [{ text: systemPrompt }]
                    }
                },
                callbacks: {
                    onopen: () => {
                        console.log('[Gemini] Live session connected!');
                        this.isSetupComplete = true;
                        this.sessionStartTime = Date.now();
                        this.startAudioCapture();
                        this.setStatus('listening');
                    },
                    onmessage: (message: LiveServerMessage) => {
                        this.handleSDKMessage(message);
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('[Gemini] Session error:', e.message);
                        this.setStatus('error');
                        this.emit('error', new Error(e.message));
                    },
                    onclose: (e: CloseEvent) => {
                        console.log(`[Gemini] Session closed: ${e.code} - ${e.reason}`);
                        this.stopRecording();
                        this.setStatus('idle');
                    }
                }
            });

            console.log('[Gemini] Live session established successfully');

        } catch (error) {
            console.error('[Gemini] Failed to establish live session:', error);
            this.setStatus('error');
            this.emit('error', error);
        }
    }

    private startAudioCapture() {
        if (this.isRecording) return;

        console.log('[Gemini] Starting audio capture (16kHz PCM)');

        const options = {
            sampleRate: 16000,  // Gemini requires 16kHz input
            channels: 1,
            bitsPerSample: 16,
            audioSource: 6,     // VOICE_RECOGNITION
            bufferSize: 4096,
        };

        LiveAudioStream.init(options);

        LiveAudioStream.on('data', (base64: string) => {
            if (this.session && this.isSetupComplete) {
                try {
                    // Send audio chunk via SDK session (synchronous)
                    this.session.sendRealtimeInput({
                        media: {
                            mimeType: 'audio/pcm;rate=16000',
                            data: base64
                        }
                    });
                } catch (err) {
                    console.error('[Gemini] Error sending audio:', err);
                }
            }
        });

        LiveAudioStream.start();
        this.isRecording = true;
        this.setStatus('listening');
    }

    private stopRecording() {
        if (this.isRecording) {
            LiveAudioStream.stop();
            this.isRecording = false;
            console.log('[Gemini] Audio capture stopped');
        }
    }

    private async handleSDKMessage(message: LiveServerMessage) {
        try {
            // Handle audio response from model turn
            if (message.serverContent?.modelTurn?.parts) {
                for (const part of message.serverContent.modelTurn.parts) {
                    // Audio data
                    if (part.inlineData?.mimeType?.startsWith('audio')) {
                        this.setStatus('speaking');
                        await this.playAudioChunk(part.inlineData.data as string);
                    }

                    // Text transcript (if available)
                    if (part.text) {
                        console.log('[Gemini] Response text:', part.text);
                        this.emit('response', { text: part.text });

                        // Check for goodbye
                        if (detectGoodbye(part.text)) {
                            setTimeout(() => this.stopConversation(), 2000);
                        }
                    }
                }
            }

            // Turn complete - back to listening
            if (message.serverContent?.turnComplete) {
                console.log('[Gemini] Turn complete');
                this.setStatus('listening');
                this.inactivityTimer.reset(() => {
                    console.log('[Gemini] Inactivity timeout');
                    this.stopConversation();
                });
            }

            // Interruption (user spoke while AI was speaking)
            if (message.serverContent?.interrupted) {
                console.log('[Gemini] Interrupted by user');
                await TrackPlayer.reset();
                this.setStatus('listening');
            }

            // Usage stats
            if (message.usageMetadata) {
                this.sessionInputTokens += message.usageMetadata.promptTokenCount || 0;
                this.sessionOutputTokens += message.usageMetadata.candidatesTokenCount || 0;
                console.log(`[Gemini] Tokens: ${this.sessionInputTokens} in, ${this.sessionOutputTokens} out`);
            }

        } catch (error) {
            console.error('[Gemini] Error handling message:', error);
        }
    }

    private async playAudioChunk(base64Audio: string) {
        try {
            // Convert base64 PCM to WAV file
            const pcmBuffer = Buffer.from(base64Audio, 'base64');
            const wavHeader = this.createWavHeader(pcmBuffer.length, 24000); // Gemini outputs 24kHz
            const wavBuffer = Buffer.concat([wavHeader, pcmBuffer]);

            const filename = `gemini_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`;
            const fileUri = `${FileSystem.cacheDirectory}${filename}`;

            await FileSystem.writeAsStringAsync(fileUri, wavBuffer.toString('base64'), {
                encoding: 'base64' as const
            });

            await TrackPlayer.add({
                url: fileUri,
                title: 'Gemini Response',
                artist: 'Gemini',
            });

            const state = await TrackPlayer.getState();
            if (state !== State.Playing) {
                await TrackPlayer.play();
            }
        } catch (error) {
            console.error('[Gemini] Audio playback error:', error);
        }
    }

    private createWavHeader(dataLength: number, sampleRate: number): Buffer {
        const header = Buffer.alloc(44);

        header.write('RIFF', 0);
        header.writeUInt32LE(36 + dataLength, 4);
        header.write('WAVE', 8);
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16);
        header.writeUInt16LE(1, 20);      // PCM format
        header.writeUInt16LE(1, 22);      // Mono
        header.writeUInt32LE(sampleRate, 24);
        header.writeUInt32LE(sampleRate * 2, 28);
        header.writeUInt16LE(2, 32);
        header.writeUInt16LE(16, 34);
        header.write('data', 36);
        header.writeUInt32LE(dataLength, 40);

        return header;
    }

    stopConversation(): void {
        console.log('[Gemini] stopConversation called');

        this.inactivityTimer.clear();
        this.stopRecording();

        if (this.sessionStartTime) {
            const durationSeconds = (Date.now() - this.sessionStartTime) / 1000;
            console.log(`[Gemini] Session duration: ${durationSeconds.toFixed(2)}s`);
            this.updateSessionDuration(durationSeconds).catch(console.error);
            this.sessionStartTime = null;
        }

        // Close SDK session
        if (this.session) {
            this.session.close();
            this.session = null;
        }

        this.isSetupComplete = false;
        this.ephemeralToken = null;

        InCallManager.stop();
        TrackPlayer.reset().catch(console.error);

        this.sessionInputTokens = 0;
        this.sessionOutputTokens = 0;

        this.setStatus('idle');
    }

    setContext(userContext: UserContext, recipeContext?: RecipeContext): void {
        if (!this.currentContext) {
            this.currentContext = { userContext, recipeContext };
        } else {
            this.currentContext.userContext = userContext;
            if (recipeContext) {
                this.currentContext.recipeContext = recipeContext;
            }
        }
        // Note: Gemini Live doesn't support mid-session instruction update
        // Context changes will apply on next startConversation
    }

    on(event: VoiceEvent, callback: Function): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event)!.add(callback);
    }

    off(event: VoiceEvent, callback: Function): void {
        this.eventListeners.get(event)?.delete(callback);
    }

    getStatus(): VoiceStatus {
        return this.status;
    }

    async getRemainingQuota(): Promise<QuotaInfo> {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const response = await fetch(
            `${process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL}/start-gemini-session`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        const data = await response.json();
        return {
            remainingMinutes: parseFloat(data.remainingMinutes),
            minutesUsed: parseFloat(data.minutesUsed),
            quotaLimit: data.quotaLimit,
            warning: data.warning,
        };
    }

    async destroy(): Promise<void> {
        this.stopConversation();
        this.eventListeners.clear();
    }

    // Private helpers

    private setStatus(status: VoiceStatus): void {
        this.status = status;
        this.emit('statusChange', status);
    }

    private emit(event: VoiceEvent, ...args: any[]): void {
        this.eventListeners.get(event)?.forEach((callback) => callback(...args));
    }

    private async updateSessionDuration(durationSeconds: number): Promise<void> {
        if (!this.sessionId) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // Cost calculation for Gemini 2.0 Flash Live
            // Audio: $3/1M input, $12/1M output (at ~25 tokens/second)
            const costUsd =
                this.sessionInputTokens * (3 / 1_000_000) +
                this.sessionOutputTokens * (12 / 1_000_000);

            console.log(`[Gemini] Session ${this.sessionId}: ${durationSeconds.toFixed(2)}s, ${this.sessionInputTokens} in, ${this.sessionOutputTokens} out, $${costUsd.toFixed(6)}`);

            await supabase
                .from('ai_voice_sessions')
                .update({
                    status: 'completed',
                    duration_seconds: durationSeconds,
                    input_tokens: this.sessionInputTokens,
                    output_tokens: this.sessionOutputTokens,
                    cost_usd: costUsd,
                    completed_at: new Date().toISOString(),
                })
                .eq('id', this.sessionId);

        } catch (error) {
            console.error('[Gemini] Error updating session:', error);
        }
    }
}
