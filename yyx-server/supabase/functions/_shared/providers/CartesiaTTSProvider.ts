/**
 * Cartesia Text-to-Speech Provider
 * Uses Daniela voice for Mexican Spanish
 */

import type { TTSProvider } from "./types.ts";

export class CartesiaTTSProvider implements TTSProvider {
  async synthesize(
    text: string,
    voice: string,
    language: "en" | "es",
  ): Promise<Uint8Array> {
    const apiKey = Deno.env.get("CARTESIA_API_KEY");
    if (!apiKey) {
      throw new Error("CARTESIA_API_KEY not configured");
    }

    console.log(
      `[Cartesia] Synthesizing: "${text}" (voice: ${voice}, lang: ${language})`,
    );

    const response = await fetch("https://api.cartesia.ai/tts/bytes", {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Cartesia-Version": "2025-04-16",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_id: "sonic-3",
        transcript: text,
        voice: {
          mode: "id",
          id: voice,
        },
        output_format: {
          container: "mp3",
          encoding: "mp3",
          sample_rate: 44100,
        },
        language: language,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cartesia API error: ${response.status} ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log(`[Cartesia] Synthesized ${arrayBuffer.byteLength} bytes`);

    return new Uint8Array(arrayBuffer);
  }

  getCost(characterCount: number): number {
    return (characterCount * 0.05) / 1_000_000; // $0.05 per 1M characters
  }
}
