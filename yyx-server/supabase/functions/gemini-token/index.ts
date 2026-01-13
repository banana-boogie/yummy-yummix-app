import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI } from "npm:@google/genai";
import { corsHeaders } from "../_shared/cors.ts";
import { validateAuth } from "../_shared/auth.ts";

console.log("Hello from Functions!");

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { status: 200, headers: corsHeaders });
    }

    try {
        const requestId = crypto.randomUUID();

        // 1. Validate Supabase Auth
        const authHeader = req.headers.get('Authorization');
        const { user, error: authError } = await validateAuth(authHeader);

        if (authError || !user) {
            console.warn(`[${requestId}] Auth failed: ${authError}`);
            return new Response(
                JSON.stringify({ error: authError ?? 'Authentication required' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.info(`[${requestId}] Generating ephemeral token for user: ${user.id}`);

        // 2. Initialize Gemini Client
        const apiKey = Deno.env.get('GEMINI_API_KEY');
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not set');
        }

        const client = new GoogleGenAI({ apiKey });

        // 3. Create Ephemeral Token
        // Scoped to "generative-language-api" typically
        // The SDK simplifies this call.
        const response = await client.authTokens.create({
            full_access: true, // Or specific scopes if supported
            // ttl: '3600s' // Optional? Defaults to 1 hour usually
        });

        // The response struct depends on the SDK version, likely has .token or .accessToken
        // Logging to debug if needed (masking info)
        console.info(`[${requestId}] Token generated, expires: ${response.expireTime}`);

        return new Response(
            JSON.stringify(response),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error generating token:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
