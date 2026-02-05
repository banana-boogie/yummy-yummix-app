/**
 * OpenAI LLM Provider
 * Uses GPT-4o-mini with streaming for low-latency responses
 */

import type { LLMProvider } from "./types.ts";

export class OpenAILLMProvider implements LLMProvider {
  async streamResponse(
    systemPrompt: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    onSentence: (sentence: string) => void,
    onComplete: (fullResponse: string) => void,
  ): Promise<{ inputTokens: number; outputTokens: number }> {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    console.log("[OpenAI LLM] Starting streaming request...");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
        stream_options: { include_usage: true }, // Request token usage
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    let fullResponse = "";
    let buffer = "";
    let inputTokens = 0;
    let outputTokens = 0;

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              console.log("[OpenAI LLM] Stream completed");
              continue;
            }

            try {
              const parsed = JSON.parse(data);

              // Extract content delta
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullResponse += content;
                buffer += content;

                // Detect sentence boundary (. ! ? followed by space or end)
                const sentenceMatch = buffer.match(/[.!?](\s|$)/);
                if (sentenceMatch) {
                  const sentenceEnd = sentenceMatch.index! +
                    sentenceMatch[0].length;
                  const sentence = buffer.slice(0, sentenceEnd).trim();

                  if (sentence) {
                    console.log("[OpenAI LLM] Sentence complete:", sentence);
                    onSentence(sentence);
                  }

                  // Keep remaining text in buffer
                  buffer = buffer.slice(sentenceEnd).trim();
                }
              }

              // Extract token usage (appears in last chunk)
              if (parsed.usage) {
                inputTokens = parsed.usage.prompt_tokens || 0;
                outputTokens = parsed.usage.completion_tokens || 0;
                console.log(
                  `[OpenAI LLM] Token usage - Input: ${inputTokens}, Output: ${outputTokens}`,
                );
              }
            } catch (error) {
              console.error("[OpenAI LLM] Failed to parse chunk:", error);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Send any remaining buffer as final sentence
    if (buffer.trim()) {
      console.log("[OpenAI LLM] Final sentence:", buffer.trim());
      onSentence(buffer.trim());
    }

    console.log("[OpenAI LLM] Full response complete");
    onComplete(fullResponse);

    // If no usage data from stream, estimate based on text length
    if (inputTokens === 0 || outputTokens === 0) {
      // Rough estimate: ~4 characters per token
      const estimatedOutput = Math.ceil(fullResponse.length / 4);
      const estimatedInput = Math.ceil(
        (systemPrompt + messages.map((m) => m.content).join(" ")).length / 4,
      );

      if (inputTokens === 0) inputTokens = estimatedInput;
      if (outputTokens === 0) outputTokens = estimatedOutput;

      console.warn(
        `[OpenAI LLM] Using estimated tokens - Input: ${inputTokens}, Output: ${outputTokens}`,
      );
    }

    return { inputTokens, outputTokens };
  }
}
