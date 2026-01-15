/**
 * Deepgram Speech-to-Text Provider
 * Uses Nova-2 model with built-in VAD for utterance detection
 */

import type { STTProvider, STTConfig } from './types.ts';

export class DeepgramSTTProvider implements STTProvider {
  private ws: WebSocket | null = null;
  private startTime: number | null = null;
  private onTranscriptCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private onUtteranceEndCallback: (() => void) | null = null;

  async connect(config: STTConfig): Promise<void> {
    const apiKey = Deno.env.get('DEEPGRAM_API_KEY');
    if (!apiKey) {
      throw new Error('DEEPGRAM_API_KEY not configured');
    }

    // Build Deepgram WebSocket URL with parameters
    const url = new URL('wss://api.deepgram.com/v1/listen');
    url.searchParams.set('model', 'nova-2');
    url.searchParams.set('language', config.language);
    url.searchParams.set('encoding', config.encoding);
    url.searchParams.set('sample_rate', config.sampleRate.toString());
    url.searchParams.set('channels', '1');
    url.searchParams.set('utterance_end_ms', config.utteranceEndMs.toString());
    url.searchParams.set('vad_events', 'true');
    url.searchParams.set('punctuate', 'true');
    url.searchParams.set('smart_format', 'true');
    url.searchParams.set('interim_results', 'false'); // Only final transcripts

    console.log('[Deepgram] Connecting to:', url.toString());

    // Use Sec-WebSocket-Protocol for authentication (Deepgram's recommended approach)
    // Pass 'token' and the API key as WebSocket subprotocols
    this.ws = new WebSocket(url.toString(), ['token', apiKey]);

    // Wait for connection to open
    await new Promise<void>((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not initialized'));
        return;
      }

      this.ws.onopen = () => {
        console.log('[Deepgram] Connected');
        this.startTime = Date.now();
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('[Deepgram] Connection error:', error);
        reject(new Error('Failed to connect to Deepgram'));
      };

      // Set up message handler
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('[Deepgram] Failed to parse message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('[Deepgram] Connection closed');
      };
    });
  }

  onTranscript(callback: (text: string, isFinal: boolean) => void): void {
    this.onTranscriptCallback = callback;
  }

  onUtteranceEnd(callback: () => void): void {
    this.onUtteranceEndCallback = callback;
  }

  sendAudio(chunk: Uint8Array): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(chunk);
    } else {
      console.warn('[Deepgram] Cannot send audio - WebSocket not open');
    }
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      // Send close message to flush any remaining audio
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'CloseStream' }));
      }

      this.ws.close();
      this.ws = null;
    }
  }

  getDurationSeconds(): number {
    if (!this.startTime) return 0;
    return (Date.now() - this.startTime) / 1000;
  }

  getCost(): number {
    const durationMinutes = this.getDurationSeconds() / 60;
    return durationMinutes * 0.0043; // $0.0043 per minute for Nova-2
  }

  private handleMessage(data: any): void {
    if (data.type === 'Results') {
      const transcript = data.channel?.alternatives?.[0]?.transcript;
      const isFinal = data.is_final === true;

      if (transcript && this.onTranscriptCallback) {
        console.log(`[Deepgram] Transcript (final: ${isFinal}):`, transcript);
        this.onTranscriptCallback(transcript, isFinal);
      }
    } else if (data.type === 'UtteranceEnd') {
      console.log('[Deepgram] Utterance end detected');
      if (this.onUtteranceEndCallback) {
        this.onUtteranceEndCallback();
      }
    } else if (data.type === 'Metadata') {
      console.log('[Deepgram] Metadata received');
    } else {
      console.log('[Deepgram] Unknown message type:', data.type);
    }
  }
}
