import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { validateAuth } from '../_shared/auth.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
    // CORS Headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
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

        // 2. Check quota
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
            }), { status: 429 });
        }

        // Soft warning at 80%
        const warningThreshold = QUOTA_LIMIT * 0.8; // 24 minutes
        const warning = minutesUsed >= warningThreshold ?
            `You've used ${minutesUsed.toFixed(1)} of ${QUOTA_LIMIT} minutes this month.` :
            null;

        // 3. Generate Ephemeral Token (for secure direct connection)
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openaiApiKey) {
            console.error('OPENAI_API_KEY is missing');
            return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log('Requesting ephemeral token from OpenAI...');
        const tokenResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-realtime-preview-2024-10-01',
                voice: 'alloy',
            }),
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('OpenAI Token Error:', errorText);
            return new Response(JSON.stringify({ error: 'Failed to generate AI token', details: errorText }), {
                status: 502,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const tokenData = await tokenResponse.json();
        const ephemeralToken = tokenData.client_secret.value;
        console.log('Ephemeral token generated successfully');

        // 4. Create session record
        const { data: session } = await supabase
            .from('ai_voice_sessions')
            .insert({
                user_id: user.id,
                status: 'active',
                started_at: new Date().toISOString()
            })
            .select()
            .single();

        // 5. Return Ephemeral Token + quota info
        return new Response(JSON.stringify({
            sessionId: session.id,
            ephemeralToken,
            remainingMinutes: remainingMinutes.toFixed(1),
            warning,
            quotaLimit: QUOTA_LIMIT,
            minutesUsed: minutesUsed.toFixed(1)
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
