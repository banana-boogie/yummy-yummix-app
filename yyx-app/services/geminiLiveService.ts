import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import TrackPlayer, { Capability, State } from 'react-native-track-player';
import LiveAudioStream from 'react-native-live-audio-stream';
import { supabase } from '@/lib/supabase';
import { Buffer } from 'buffer';

const GEMINI_WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';

interface GeminiConfig {
    systemInstruction?: string;
}

export class GeminiLiveService {
    private ws: WebSocket | null = null;
    private isConnected = false;
    private audioQueue: string[] = [];
    private isPlaying = false;

    constructor() {
        this.setupPlayer();
    }

    private async setupPlayer() {
        try {
            await TrackPlayer.setupPlayer();
            // Configure for minimal latency
            await TrackPlayer.updateOptions({
                capabilities: [Capability.Play, Capability.Stop],
                compactCapabilities: [Capability.Play, Capability.Stop],
            });
        } catch (e) {
            console.log('Player setup error (ignore if already set up):', e);
        }
    }

    async connect(config: GeminiConfig) {
        // 1. Get Ephemeral Token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Not authenticated');

        const functionsUrl = process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL;
        const response = await fetch(`${functionsUrl}/gemini-token`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
            },
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to get Gemini token: ${text}`);
        }

        const data = await response.json();
        const accessToken = data.accessToken || data.token; // Handle different SDK responses

        // 2. Connect WebSocket
        // @ts-ignore - React Native supports headers in 3rd arg
        this.ws = new WebSocket(GEMINI_WS_URL, null, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        this.ws.onopen = () => {
            console.log('[Gemini] Connected');
            this.isConnected = true;
            this.sendSetupMessage(config);
            this.startAudioStream();
        };

        this.ws.onmessage = async (e) => {
            let msg;
            if (typeof e.data === 'string') {
                msg = JSON.parse(e.data);
            } else {
                return;
            }
            await this.handleServerMessage(msg);
        };

        this.ws.onerror = (e) => {
            console.error('[Gemini] Error:', e.message);
        };

        this.ws.onclose = (e) => {
            console.log('[Gemini] Closed:', e.code, e.reason);
            this.isConnected = false;
            this.stopAudioStream();
        };
    }

    private sendSetupMessage(config: GeminiConfig) {
        if (!this.ws) return;

        const setupMsg = {
            setup: {
                model: "models/gemini-2.0-flash-exp",
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } }
                    }
                },
                systemInstruction: {
                    parts: [{ text: config.systemInstruction || "You are a helpful assistant." }]
                }
            }
        };

        this.ws.send(JSON.stringify(setupMsg));
    }

    private startAudioStream() {
        const options = {
            sampleRate: 16000,
            channels: 1,
            bitsPerSample: 16,
            audioSource: 6,
            bufferSize: 4096,
        };

        LiveAudioStream.init(options);

        LiveAudioStream.on('data', (base64: string) => {
            if (this.ws && this.isConnected) {
                const audioMsg = {
                    realtimeInput: {
                        mediaChunks: [{
                            mimeType: "audio/pcm;rate=16000",
                            data: base64
                        }]
                    }
                };
                this.ws.send(JSON.stringify(audioMsg));
            }
        });

        LiveAudioStream.start();
    }

    private stopAudioStream() {
        LiveAudioStream.stop();
    }

    private async handleServerMessage(msg: any) {
        // Handle Audio
        if (msg.serverContent?.modelTurn?.parts) {
            for (const part of msg.serverContent.modelTurn.parts) {
                if (part.inlineData && part.inlineData.mimeType.startsWith('audio')) {
                    const base64 = part.inlineData.data;
                    await this.queueAudio(base64);
                }
            }
        }

        // Handle TurnComplete - Barge In
        // If the server says turn is complete, often means it finished speaking.
        // But if we defined local barge-in (user spoke), we would have cleared playback.

        // Gemini sends interruption events? 
        // If msg.serverContent.interrupted is true?
        if (msg.serverContent?.interrupted) {
            console.log('[Gemini] Interrupted by user');
            await TrackPlayer.reset();
        }
    }

    private async queueAudio(base64: string) {
        // Convert PCM base64 to WAV file
        const pcmBuffer = Buffer.from(base64, 'base64');
        const wavHeader = this.createWavHeader(pcmBuffer.length, 24000);
        const wavBuffer = Buffer.concat([wavHeader, pcmBuffer]);

        const filename = `gemini_${Date.now()}_${Math.random()}.wav`;
        const fileUri = `${FileSystem.cacheDirectory}${filename}`;

        await FileSystem.writeAsStringAsync(fileUri, wavBuffer.toString('base64'), {
            encoding: FileSystem.EncodingType.Base64
        });

        await TrackPlayer.add({
            url: fileUri,
            title: 'Response Chunk',
            artist: 'Gemini',
        });

        const state = await TrackPlayer.getState();
        if (state !== State.Playing) {
            await TrackPlayer.play();
        }
    }

    private createWavHeader(dataLength: number, sampleRate: number): Buffer {
        const header = Buffer.alloc(44);

        // RIFF chunk
        header.write('RIFF', 0);
        header.writeUInt32LE(36 + dataLength, 4); // File size - 8
        header.write('WAVE', 8);

        // fmt chunk
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16); // Chunk size
        header.writeUInt16LE(1, 20); // Audio format (1 = PCM)
        header.writeUInt16LE(1, 22); // Num channels (Mono)
        header.writeUInt32LE(sampleRate, 24); // Sample rate
        header.writeUInt32LE(sampleRate * 2, 28); // Byte rate (SampleRate * BlockAlign)
        header.writeUInt16LE(2, 32); // Block align (NumChannels * BitsPerSample/8)
        header.writeUInt16LE(16, 34); // Bits per sample

        // data chunk
        header.write('data', 36);
        header.writeUInt32LE(dataLength, 40);

        return header;
    }

    async disconnect() {
        this.ws?.close();
        this.stopAudioStream();
        await TrackPlayer.reset();
    }
}
