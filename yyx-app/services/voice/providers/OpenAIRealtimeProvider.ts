import { RTCPeerConnection, RTCSessionDescription, mediaDevices, RTCDataChannel } from 'react-native-webrtc';
import { supabase } from '@/lib/supabase';
import type {
    VoiceAssistantProvider,
    VoiceStatus,
    VoiceEvent,
    ProviderConfig,
    ConversationContext,
    UserContext,
    RecipeContext,
    QuotaInfo
} from '../types';

export class OpenAIRealtimeProvider implements VoiceAssistantProvider {
    private pc: RTCPeerConnection | null = null;
    private dc: RTCDataChannel | null = null;
    private status: VoiceStatus = 'idle';
    private sessionId: string | null = null;
    private sessionStartTime: number | null = null;
    private eventListeners: Map<VoiceEvent, Set<Function>> = new Map();
    private currentContext: ConversationContext | null = null;

    async initialize(config: ProviderConfig): Promise<void> {
        this.sessionId = config.sessionId;
        this.setStatus('connecting');

        try {
            // 1. Create peer connection
            this.pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });

            // 2. Add local audio track (microphone)
            const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
            stream.getTracks().forEach(track => {
                this.pc!.addTrack(track, stream);
            });

            // 3. Set up data channel for events
            this.dc = this.pc.createDataChannel('oai-events');

            this.dc.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleServerMessage(message);
            };

            // 4. Create offer and get ephemeral key from OpenAI
            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);

            // 5. Exchange SDP with OpenAI
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
                    'Content-Type': 'application/sdp'
                },
                body: offer.sdp
            });

            const answerSdp = await response.text();
            await this.pc.setRemoteDescription(
                new RTCSessionDescription({ type: 'answer', sdp: answerSdp })
            );

            // 6. Handle incoming audio
            this.pc.ontrack = (event) => {
                // Audio is played automatically by WebRTC
                console.log('[OpenAI] Receiving audio stream');
            };

            this.setStatus('idle');
        } catch (error) {
            console.error('[OpenAI] Initialize error:', error);
            this.setStatus('error');
            this.emit('error', error);
            throw error;
        }
    }

    async startConversation(context: ConversationContext): Promise<void> {
        this.currentContext = context;
        this.sessionStartTime = Date.now();
        this.setStatus('listening');

        // Send session configuration with context via data channel
        const systemPrompt = this.buildSystemPrompt(context);

        this.sendEvent({
            type: 'session.update',
            session: {
                modalities: ['text', 'audio'],
                instructions: systemPrompt,
                voice: context.userContext.language === 'es' ? 'alloy' : 'echo',
                input_audio_format: 'pcm16',
                output_audio_format: 'pcm16',
                input_audio_transcription: { model: 'whisper-1' },
                turn_detection: {
                    type: 'server_vad',
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 800 // 800ms silence = user finished
                }
            }
        });
    }

    stopConversation(): void {
        if (this.sessionStartTime) {
            const durationSeconds = (Date.now() - this.sessionStartTime) / 1000;
            this.updateSessionDuration(durationSeconds);
            this.sessionStartTime = null;
        }

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

        // Update session instructions mid-conversation
        if (this.dc && this.dc.readyState === 'open') {
            const systemPrompt = this.buildSystemPrompt(this.currentContext);
            this.sendEvent({
                type: 'session.update',
                session: { instructions: systemPrompt }
            });
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
            `${process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL}/start-voice-session`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const data = await response.json();

        return {
            remainingMinutes: parseFloat(data.remainingMinutes),
            minutesUsed: parseFloat(data.minutesUsed),
            quotaLimit: data.quotaLimit,
            warning: data.warning
        };
    }

    async destroy(): Promise<void> {
        this.stopConversation();
        this.dc?.close();
        this.pc?.close();
        this.eventListeners.clear();
    }

    // Private methods

    private setStatus(status: VoiceStatus): void {
        this.status = status;
        this.emit('statusChange', status);
    }

    private emit(event: VoiceEvent, ...args: any[]): void {
        this.eventListeners.get(event)?.forEach(callback => callback(...args));
    }

    private sendEvent(event: any): void {
        if (this.dc && this.dc.readyState === 'open') {
            this.dc.send(JSON.stringify(event));
        }
    }

    private handleServerMessage(message: any): void {
        switch (message.type) {
            case 'conversation.item.input_audio_transcription.completed':
                // User's speech transcribed
                this.emit('transcript', message.transcript);
                this.setStatus('processing');
                break;

            case 'response.audio.delta':
                // Audio chunk received (played automatically by WebRTC)
                this.setStatus('speaking');
                break;

            case 'response.done':
                // Response complete
                this.emit('response', message.response);
                this.setStatus('listening');
                break;

            case 'error':
                this.emit('error', new Error(message.error.message));
                this.setStatus('error');
                break;
        }
    }

    private buildSystemPrompt(context: ConversationContext): string {
        const { userContext, recipeContext } = context;
        const lang = userContext.language === 'es' ? 'Español (México)' : 'English';
        const restrictions = userContext.dietaryRestrictions?.join(', ') || 'none';
        const diets = userContext.dietTypes?.join(', ') || 'none';

        let prompt = `You are Irmixy, YummyYummix's friendly AI sous chef assistant.

User Profile:
- Language: ${lang}
- Dietary restrictions: ${restrictions}
- Diet type: ${diets}
- Measurements: ${userContext.measurementSystem}`;

        if (recipeContext) {
            prompt += `

Current Cooking Context:
- Recipe: ${recipeContext.recipeTitle}
- Step ${recipeContext.currentStep} of ${recipeContext.totalSteps}
- Current instruction: ${recipeContext.stepInstructions}`;
        }

        prompt += `

IMPORTANT: Keep ALL responses to 1-2 sentences maximum since they will be spoken aloud. Be warm, encouraging, and helpful.`;

        return prompt;
    }

    private async updateSessionDuration(durationSeconds: number): Promise<void> {
        if (!this.sessionId) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        await supabase
            .from('voice_sessions')
            .update({
                status: 'completed',
                duration_seconds: durationSeconds,
                completed_at: new Date().toISOString()
            })
            .eq('id', this.sessionId);
    }
}
