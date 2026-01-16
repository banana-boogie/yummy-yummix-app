/**
 * Gemini Live Voice Provider
 * 
 * Implements VoiceAssistantProvider for Google's Gemini Live API.
 * Uses @google/genai SDK's live.connect() for proper ephemeral token auth.
 * 
 * Architecture (based on official Gemini docs):
 * 1. Backend mints ephemeral token via authTokens.create()
 * 2. Client uses SDK's live.connect() with token as apiKey
 * 3. Audio capture via react-native-live-audio-stream (16kHz input)
 * 4. Audio playback via expo-audio (24kHz output from Gemini)
 * 5. Separate message queue + playback loop for smooth audio
 */

import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';
import InCallManager from 'react-native-incall-manager';
import LiveAudioStream from 'react-native-live-audio-stream';
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
    // Session management
    private session: Session | null = null;
    private sessionId: string | null = null;
    private sessionStartTime: number | null = null;
    private ephemeralToken: string | null = null;
    private isSetupComplete = false;

    // State
    private status: VoiceStatus = 'idle';
    private isRecording = false;
    private currentContext: ConversationContext | null = null;

    // Audio playback - separate queues per official Gemini pattern
    private audioQueue: Buffer[] = [];           // Decoded PCM buffers ready to play
    private isPlaybackLoopRunning = false;
    private shouldStopAudio = false;

    // Event system
    private eventListeners: Map<VoiceEvent, Set<Function>> = new Map();
    private inactivityTimer = new InactivityTimer(30000); // 30 seconds

    // Token tracking for cost calculation
    private sessionInputTokens = 0;
    private sessionOutputTokens = 0;

    constructor() {
        // No async setup needed - InCallManager handles audio routing in startConversation
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
            this.setStatus('idle');
            return data;

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
            // Initialize SDK with ephemeral token
            const ai = new GoogleGenAI({
                apiKey: this.ephemeralToken,
                httpOptions: { apiVersion: 'v1alpha' }
            });

            const systemPrompt = buildSystemPrompt(context);
            const languageCode = context.userContext.language === 'es' ? 'es-ES' : 'en-US';
            console.log('[Gemini] System prompt:', systemPrompt);
            console.log('[Gemini] Language code:', languageCode);
            console.log('[Gemini] Establishing live connection...');

            // Connect using SDK's live.connect()
            this.session = await ai.live.connect({
                model: 'models/gemini-2.0-flash-exp',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        languageCode: languageCode,
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
                        this.handleMessage(message);
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

    /**
     * Handle incoming messages from Gemini
     * Based on official Gemini pattern: queue audio, handle interruptions
     */
    private handleMessage(message: LiveServerMessage) {
        try {
            // Handle interruption - clear audio queue immediately
            if (message.serverContent?.interrupted) {
                console.log('[Gemini] Interrupted by user');
                this.audioQueue = [];
                this.shouldStopAudio = true;
                this.setStatus('listening');
                this.inactivityTimer.reset(() => {
                    console.log('[Gemini] Inactivity timeout');
                    this.stopConversation();
                });
                return;
            }

            // Handle audio response
            if (message.serverContent?.modelTurn?.parts) {
                console.log('[Gemini] Received modelTurn with', message.serverContent.modelTurn.parts.length, 'parts');
                for (const part of message.serverContent.modelTurn.parts) {
                    // Queue audio data
                    if (part.inlineData?.mimeType?.startsWith('audio') && part.inlineData.data) {
                        this.setStatus('speaking');
                        const pcmBuffer = Buffer.from(part.inlineData.data as string, 'base64');
                        this.audioQueue.push(pcmBuffer);

                        // Start playback loop if not running
                        if (!this.isPlaybackLoopRunning) {
                            this.runPlaybackLoop();
                        }
                    }

                    // Handle text transcript
                    if (part.text) {
                        console.log('[Gemini] Response text:', part.text);
                        this.emit('response', { text: part.text });

                        if (detectGoodbye(part.text)) {
                            setTimeout(() => this.stopConversation(), 2000);
                        }
                    }
                }
            }

            // Turn complete - ready to listen again
            if (message.serverContent?.turnComplete) {
                console.log('[Gemini] Turn complete - ready for next input');
                console.log('[Gemini] Session state after turnComplete:', {
                    sessionOpen: !!this.session,
                    isRecording: this.isRecording,
                    isSetupComplete: this.isSetupComplete,
                    status: this.status
                });
                this.setStatus('listening');
                this.inactivityTimer.reset(() => {
                    console.log('[Gemini] Inactivity timeout after turnComplete');
                    this.stopConversation();
                });
            }

            // Track usage
            if (message.usageMetadata) {
                this.sessionInputTokens += message.usageMetadata.promptTokenCount || 0;
                this.sessionOutputTokens += message.usageMetadata.responseTokenCount || 0;
                console.log(`[Gemini] Tokens: ${this.sessionInputTokens} in, ${this.sessionOutputTokens} out`);
            }

        } catch (error) {
            console.error('[Gemini] Error handling message:', error);
        }
    }

    /**
     * Playback loop - plays audio chunks from queue
     * Accumulates chunks for smoother playback (~1 second buffers)
     * IMPORTANT: Mutes mic during playback to prevent echo detection
     */
    private async runPlaybackLoop() {
        if (this.isPlaybackLoopRunning) return;
        this.isPlaybackLoopRunning = true;
        this.shouldStopAudio = false;

        // CRITICAL: Mute microphone during playback to prevent echo
        // This prevents the AI from hearing its own output as "user interruption"
        InCallManager.setMicrophoneMute(true);
        console.log('[Gemini] Mic muted for playback (echo prevention)');

        const { createAudioPlayer } = await import('expo-audio');

        // Accumulate for smoother playback
        let accumulatedPcm = Buffer.alloc(0);
        const TARGET_BUFFER_SIZE = 24000 * 2 * 1.0; // ~1 second of 24kHz 16-bit mono
        let chunkCount = 0;

        try {
            while (!this.shouldStopAudio) {
                // Drain queue into accumulator
                while (this.audioQueue.length > 0 && accumulatedPcm.length < TARGET_BUFFER_SIZE) {
                    const chunk = this.audioQueue.shift();
                    if (chunk) {
                        accumulatedPcm = Buffer.concat([accumulatedPcm, chunk]);
                    }
                }

                // Play if we have enough data OR queue is empty and we have some data
                const shouldPlay = accumulatedPcm.length >= TARGET_BUFFER_SIZE ||
                    (this.audioQueue.length === 0 && accumulatedPcm.length > 0);

                if (shouldPlay && accumulatedPcm.length > 0 && !this.shouldStopAudio) {
                    try {
                        chunkCount++;
                        const durationMs = (accumulatedPcm.length / (24000 * 2)) * 1000;
                        console.log(`[Gemini] Playing chunk #${chunkCount} (~${durationMs.toFixed(0)}ms)`);

                        // Create WAV with 24kHz header
                        const wavHeader = this.createWavHeader(accumulatedPcm.length, 24000);
                        const wavBuffer = Buffer.concat([wavHeader, accumulatedPcm]);
                        const wavBase64 = wavBuffer.toString('base64');

                        // Reset accumulator
                        accumulatedPcm = Buffer.alloc(0);

                        // Play audio
                        const player = createAudioPlayer({ uri: `data:audio/wav;base64,${wavBase64}` });

                        await new Promise<void>((resolve) => {
                            player.addListener('playbackStatusUpdate', (status: any) => {
                                if (status.didJustFinish || this.shouldStopAudio) {
                                    player.release();
                                    resolve();
                                }
                            });
                            player.play();
                        });

                    } catch (error) {
                        console.error('[Gemini] Playback error:', error);
                        accumulatedPcm = Buffer.alloc(0); // Clear on error
                    }
                }

                // Exit if nothing left to play
                if (this.audioQueue.length === 0 && accumulatedPcm.length === 0) {
                    break;
                }

                // Small delay to allow accumulation
                if (!this.shouldStopAudio) {
                    await new Promise(r => setTimeout(r, 50));
                }
            }
        } finally {
            // CRITICAL: Always unmute mic when playback ends
            InCallManager.setMicrophoneMute(false);
            console.log('[Gemini] Mic unmuted after playback');
            this.isPlaybackLoopRunning = false;
        }
    }

    /**
     * Create WAV header for PCM data
     */
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

    /**
     * Start capturing audio from microphone
     * IMPORTANT: Skips sending audio while AI is speaking to prevent self-interruption
     */
    private startAudioCapture() {
        if (this.isRecording) return;

        console.log('[Gemini] Starting audio capture (16kHz PCM)');

        const options = {
            sampleRate: 16000,
            channels: 1,
            bitsPerSample: 16,
            audioSource: 6,     // VOICE_RECOGNITION
            bufferSize: 4096,
            wavFile: '',        // Required by types but not actually used
        };

        LiveAudioStream.init(options);

        let chunkCount = 0;
        LiveAudioStream.on('data', (base64: string) => {
            // CRITICAL: Skip sending audio while AI is speaking
            // This prevents Gemini from detecting playback audio as user input
            if (this.isPlaybackLoopRunning) {
                return; // Don't send audio while speaking
            }

            if (this.session && this.isSetupComplete) {
                try {
                    chunkCount++;
                    if (chunkCount % 100 === 0) {
                        console.log(`[Gemini] Sent audio chunk #${chunkCount}`);
                    }

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

        // Stop audio playback
        this.shouldStopAudio = true;
        this.audioQueue = [];

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

            // Gemini 2.0 Flash Live pricing: $3/1M input, $12/1M output
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
