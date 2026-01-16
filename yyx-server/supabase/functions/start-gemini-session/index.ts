/**
 * Start Gemini Live Session
 * 
 * Generates an ephemeral token for direct client connection to Gemini Live API.
 * Mirrors the OpenAI start-voice-session pattern for consistency.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { validateAuth } from '../_shared/auth.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenAI } from 'npm:@google/genai';

serve(async (req) => {
    // CORS Headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': Deno.env.get('CORS_ORIGIN') || '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // 1. Validate auth
        const { user, error: authError } = await validateAuth(req.headers.get('Authorization'));
        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 2. Check quota (same as OpenAI)
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const { data: usage } = await supabase
            .from('ai_voice_usage')
            .select('minutes_used, conversations_count')
            .eq('user_id', user.id)
            .eq('month', currentMonth)
            .single();

        const QUOTA_LIMIT = 30; // 30 minutes/month
        const minutesUsed = usage?.minutes_used || 0;
        const remainingMinutes = QUOTA_LIMIT - minutesUsed;

        // Hard quota check
        if (minutesUsed >= QUOTA_LIMIT) {
            return new Response(JSON.stringify({
                error: 'Monthly quota exceeded',
                minutesUsed,
                quotaLimit: QUOTA_LIMIT,
                remainingMinutes: 0
            }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Soft warning at 80%
        const warningThreshold = QUOTA_LIMIT * 0.8;
        const warning = minutesUsed >= warningThreshold ?
            `You've used ${minutesUsed.toFixed(1)} of ${QUOTA_LIMIT} minutes this month.` :
            null;

        // 3. Generate Ephemeral Token for Gemini Live
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) {
            console.error('GEMINI_API_KEY is missing');
            return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log('[Gemini] Generating ephemeral token...');

        const client = new GoogleGenAI({ apiKey: geminiApiKey });

        // Token expires in 30 minutes
        const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        const tokenResponse = await client.authTokens.create({
            config: {
                uses: 1, // Single use token
                expireTime: expireTime,
                liveConnectConstraints: {
                    model: 'models/gemini-2.0-flash-exp',
                    config: {
                        responseModalities: ['AUDIO'],
                        temperature: 0.7,
                    }
                },
                httpOptions: { apiVersion: 'v1alpha' }
            }
        });

        // Log the full response to understand the structure
        console.log(`[Gemini] Token response keys:`, Object.keys(tokenResponse));
        console.log(`[Gemini] Token response:`, JSON.stringify(tokenResponse, null, 2));

        // The token is in tokenResponse.name (which contains the actual token string)
        const ephemeralToken = tokenResponse.name;
        console.log(`[Gemini] Ephemeral token (first 20 chars): ${ephemeralToken?.substring(0, 20)}...`);
        console.log(`[Gemini] Token expires: ${expireTime}`);

        // 4. Create session record
        const { data: session } = await supabase
            .from('ai_voice_sessions')
            .insert({
                user_id: user.id,
                provider_type: 'gemini-live',
                status: 'active',
                started_at: new Date().toISOString()
            })
            .select()
            .single();

        // 5. Return Ephemeral Token + quota info
        return new Response(JSON.stringify({
            sessionId: session.id,
            ephemeralToken,
            model: 'gemini-2.0-flash-live',
            remainingMinutes: remainingMinutes.toFixed(1),
            warning,
            quotaLimit: QUOTA_LIMIT,
            minutesUsed: minutesUsed.toFixed(1)
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[Gemini] Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
