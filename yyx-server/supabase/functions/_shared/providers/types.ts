/**
 * Provider interfaces for HearThinkSpeak voice pipeline
 * These abstract interfaces allow easy vendor swapping
 */

// STT Provider configuration
export interface STTConfig {
  language: "en" | "es";
  sampleRate: number;
  encoding: string;
  utteranceEndMs: number; // Silence duration to detect utterance end
}

// STT Provider interface
export interface STTProvider {
  /**
   * Connect to STT service
   */
  connect(config: STTConfig): Promise<void>;

  /**
   * Register callback for transcript events
   * @param callback Receives text and whether it's final
   */
  onTranscript(callback: (text: string, isFinal: boolean) => void): void;

  /**
   * Register callback for utterance end detection (VAD)
   * Fires when user has finished speaking
   */
  onUtteranceEnd(callback: () => void): void;

  /**
   * Send audio chunk to STT service
   */
  sendAudio(chunk: Uint8Array): void;

  /**
   * Disconnect from STT service
   */
  disconnect(): Promise<void>;

  /**
   * Get duration of audio processed (seconds)
   */
  getDurationSeconds(): number;

  /**
   * Get total cost for STT usage
   */
  getCost(): number;
}

// LLM Provider interface
export interface LLMProvider {
  /**
   * Stream LLM response with sentence-level callbacks
   *
   * @param systemPrompt System instructions for the LLM
   * @param messages Conversation history
   * @param onSentence Called when each sentence is complete (for immediate TTS)
   * @param onComplete Called when full response is complete
   * @returns Token usage for cost calculation
   */
  streamResponse(
    systemPrompt: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    onSentence: (sentence: string) => void,
    onComplete: (fullResponse: string) => void,
  ): Promise<{ inputTokens: number; outputTokens: number }>;
}

// TTS Provider interface
export interface TTSProvider {
  /**
   * Synthesize text to speech
   *
   * @param text Text to synthesize
   * @param voice Voice ID to use
   * @param language Language code
   * @returns Audio data as Uint8Array (mp3 format)
   */
  synthesize(
    text: string,
    voice: string,
    language: "en" | "es",
  ): Promise<Uint8Array>;

  /**
   * Calculate cost for character count
   */
  getCost(characterCount: number): number;
}
