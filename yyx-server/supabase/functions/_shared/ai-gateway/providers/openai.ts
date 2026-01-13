/**
 * AI Gateway - OpenAI Provider
 * 
 * Implementation of the AI provider interface for OpenAI.
 * Includes: chat completions, transcription (Whisper), and text-to-speech.
 */

import {
    AICompletionRequest,
    AICompletionResponse,
    AITool,
    AITranscriptionRequest,
    AITranscriptionResponse,
    AITextToSpeechRequest,
    AITextToSpeechResponse,
} from '../types.ts';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_TRANSCRIPTION_URL = 'https://api.openai.com/v1/audio/transcriptions';
const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';

// =============================================================================
// Chat Completions
// =============================================================================

interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface OpenAIRequest {
    model: string;
    messages: OpenAIMessage[];
    temperature?: number;
    max_tokens?: number;
    response_format?: {
        type: 'json_schema';
        json_schema: {
            name: string;
            schema: Record<string, unknown>;
            strict: boolean;
        };
    };
    tools?: Array<{
        type: 'function';
        function: {
            name: string;
            description: string;
            parameters: Record<string, unknown>;
        };
    }>;
}

interface OpenAIResponse {
    id: string;
    model: string;
    choices: Array<{
        message: {
            content: string | null;
            tool_calls?: Array<{
                id: string;
                function: {
                    name: string;
                    arguments: string;
                };
            }>;
        };
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
    };
}

/**
 * Call OpenAI's chat completions API.
 */
export async function callOpenAI(
    request: AICompletionRequest,
    model: string,
    apiKey: string
): Promise<AICompletionResponse> {
    const openaiRequest: OpenAIRequest = {
        model,
        messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
        })),
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4096,
    };

    // Add response format if specified
    if (request.responseFormat) {
        openaiRequest.response_format = {
            type: 'json_schema',
            json_schema: {
                name: 'response',
                schema: request.responseFormat.schema,
                strict: true,
            },
        };
    }

    // Add tools if specified
    if (request.tools && request.tools.length > 0) {
        openaiRequest.tools = request.tools.map((tool: AITool) => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
            },
        }));
    }

    const response = await fetch(OPENAI_CHAT_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(openaiRequest),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
    }

    const data: OpenAIResponse = await response.json();
    const choice = data.choices[0];

    return {
        content: choice.message.content ?? '',
        model: data.model,
        usage: {
            inputTokens: data.usage.prompt_tokens,
            outputTokens: data.usage.completion_tokens,
        },
        toolCalls: choice.message.tool_calls?.map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
        })),
    };
}

/**
 * Call OpenAI's chat completions API with streaming.
 * Returns an async generator that yields content chunks.
 */
export async function* callOpenAIStream(
    request: AICompletionRequest,
    model: string,
    apiKey: string
): AsyncGenerator<string, void, unknown> {
    const openaiRequest = {
        model,
        messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
        })),
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4096,
        stream: true,
    };

    const response = await fetch(OPENAI_CHAT_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(openaiRequest),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            if (!trimmed.startsWith('data: ')) continue;

            try {
                const json = JSON.parse(trimmed.slice(6));
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                    yield content;
                }
            } catch {
                // Skip malformed JSON
            }
        }
    }
}

// =============================================================================
// Transcription (Whisper)
// =============================================================================

/**
 * Transcribe audio using OpenAI Whisper API.
 */
export async function transcribeOpenAI(
    request: AITranscriptionRequest,
    model: string,
    apiKey: string
): Promise<AITranscriptionResponse> {
    const formData = new FormData();
    formData.append('file', request.audio, 'audio.m4a');
    formData.append('model', model);

    if (request.language) {
        formData.append('language', request.language);
    }

    const response = await fetch(OPENAI_TRANSCRIPTION_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenAI Whisper error (${response.status}): ${errorBody}`);
    }

    const result = await response.json();
    return {
        text: result.text,
        model: model,
    };
}

// =============================================================================
// Text-to-Speech
// =============================================================================

/**
 * Generate speech from text using OpenAI TTS API.
 */
export async function textToSpeechOpenAI(
    request: AITextToSpeechRequest,
    model: string,
    apiKey: string
): Promise<AITextToSpeechResponse> {
    const response = await fetch(OPENAI_TTS_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: model,
            input: request.text,
            voice: request.voice ?? 'nova',
            response_format: 'mp3',
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenAI TTS error (${response.status}): ${errorBody}`);
    }

    // Convert to base64 (chunked to avoid stack overflow on large files)
    const audioBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(audioBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);

    return {
        audioBase64: base64,
        model: model,
    };
}
