/**
 * AI Voice Edge Function
 * 
 * Handles voice conversation using the AI Gateway for all operations:
 * - transcribe() → Speech-to-text (routed via gateway)
 * - complete() → AI response generation (routed via gateway)
 * - textToSpeech() → Text-to-speech (routed via gateway)
 */

// @ts-ignore
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { validateAuth, unauthorizedResponse } from '../_shared/auth.ts';
import { chat, transcribe, textToSpeech, AIMessage } from '../_shared/ai-gateway/index.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// =============================================================================
// Types
// =============================================================================

interface VoiceResponse {
    transcription: string;
    response: string;
    audioBase64: string;
    sessionId: string;
}

// =============================================================================
// System Prompts (Bilingual) - Keep responses concise for voice
// =============================================================================

const SYSTEM_PROMPTS = {
    en: `You are Irmixy, a cheerful and helpful AI chef assistant for YummyYummix. You're passionate about cooking and love sharing tips! Keep responses SHORT and conversational (1-2 sentences max) since they will be spoken aloud. Be friendly and encouraging.`,
    es: `Eres Irmixy, una asistente de cocina alegre y servicial para YummyYummix. ¡Te apasiona cocinar y te encanta compartir consejos! Mantén tus respuestas CORTAS y conversacionales (1-2 oraciones máximo) ya que serán habladas. Sé amigable y alentadora.`
};

// =============================================================================
// Helper Functions
// =============================================================================

function createSupabaseClient(): SupabaseClient {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

async function getOrCreateSession(
    supabase: SupabaseClient,
    userId: string,
    sessionId?: string
): Promise<string> {
    if (sessionId) return sessionId;

    const { data: newSession, error } = await supabase
        .from('user_chat_sessions')
        .insert({ user_id: userId })
        .select('id')
        .single();

    if (error) throw new Error(`Failed to create session: ${error.message}`);
    return newSession.id;
}

async function getChatHistory(
    supabase: SupabaseClient,
    sessionId: string
): Promise<AIMessage[]> {
    const { data: history } = await supabase
        .from('user_chat_messages')
        .select('role, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(6);

    return (history || []).map((m: any) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content
    }));
}

async function saveMessages(
    supabase: SupabaseClient,
    sessionId: string,
    userMessage: string,
    assistantMessage: string
): Promise<void> {
    await supabase.from('user_chat_messages').insert([
        { session_id: sessionId, role: 'user', content: userMessage },
        { session_id: sessionId, role: 'assistant', content: assistantMessage }
    ]);
}

// =============================================================================
// Main Handler
// =============================================================================

serve(async (req: Request) => {
    const requestId = crypto.randomUUID();
    console.info(`[${requestId}] AI Voice request received`);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { status: 200, headers: corsHeaders });
    }

    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    const { user, error: authError } = await validateAuth(authHeader);

    if (authError || !user) {
        console.warn(`[${requestId}] Auth failed: ${authError}`);
        return unauthorizedResponse(authError ?? 'Authentication required', corsHeaders);
    }

    console.info(`[${requestId}] Authenticated user: ${user.id}`);

    try {
        // Parse multipart form data
        const formData = await req.formData();
        const audioFile = formData.get('audio') as File | null;
        const sessionId = formData.get('sessionId') as string | null;
        const language = (formData.get('language') as 'en' | 'es') || 'en';

        if (!audioFile) {
            return new Response(
                JSON.stringify({ error: 'Audio file is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
        }

        console.info(`[${requestId}] Processing audio: ${audioFile.size} bytes, type: ${audioFile.type}`);

        const supabase = createSupabaseClient();

        // Step 1: Transcribe audio using AI Gateway
        // The gateway routes to the configured transcription provider (default: OpenAI Whisper)
        console.info(`[${requestId}] Transcribing audio...`);
        const transcriptionResult = await transcribe({
            audio: audioFile,
            language: language,
        });
        console.info(`[${requestId}] Transcription: "${transcriptionResult.text}"`);

        if (!transcriptionResult.text.trim()) {
            return new Response(
                JSON.stringify({ error: 'Could not understand audio' }),
                { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
        }

        // Step 2: Get or create session
        const currentSessionId = await getOrCreateSession(supabase, user.id, sessionId || undefined);

        // Step 3: Get chat history
        const history = await getChatHistory(supabase, currentSessionId);

        // Step 4: Get AI response using AI Gateway
        // Uses 'voice' usage type for shorter responses optimized for speech
        const systemPrompt = SYSTEM_PROMPTS[language] || SYSTEM_PROMPTS.en;
        const messages: AIMessage[] = [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: transcriptionResult.text }
        ];

        console.info(`[${requestId}] Getting AI response...`);
        const aiResponse = await chat({
            usageType: 'voice', // Uses voice-optimized model config
            messages,
            temperature: 0.7,
            maxTokens: 150,
        });

        console.info(`[${requestId}] AI response: "${aiResponse.content.substring(0, 100)}..."`);

        // Step 5: Generate speech using AI Gateway
        // The gateway routes to the configured TTS provider (default: OpenAI TTS)
        console.info(`[${requestId}] Generating speech...`);
        const ttsResult = await textToSpeech({
            text: aiResponse.content,
            voice: 'nova', // Warm, trustworthy female voice (like a caring mom/grandma)
            model: 'tts-1-hd', // Higher quality audio
        });

        // Step 6: Save messages
        await saveMessages(supabase, currentSessionId, transcriptionResult.text, aiResponse.content);

        // Return response
        const response: VoiceResponse = {
            transcription: transcriptionResult.text,
            response: aiResponse.content,
            audioBase64: ttsResult.audioBase64,
            sessionId: currentSessionId,
        };

        return new Response(
            JSON.stringify(response),
            { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );

    } catch (error) {
        console.error(`[${requestId}] Error:`, error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
    }
});
