/**
 * Supabase Client Factory
 *
 * Creates Supabase clients with proper URL handling for both
 * local development (Docker) and production environments.
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Get the correct Supabase URL for the current environment.
 *
 * In local development, edge functions run in Docker where:
 * - SUPABASE_URL is set to 'http://kong:8000' (internal Docker network)
 * - This doesn't work for auth calls from within the function
 * - We need to use 'host.docker.internal' to reach the host machine
 */
export function getSupabaseUrl(): string {
    let url = Deno.env.get('SUPABASE_URL') || '';

    // Fix for local development: kong:8000 is internal Docker address
    if (url.includes('kong:8000')) {
        url = 'http://host.docker.internal:54321';
    }

    return url;
}

/**
 * Create a Supabase client with service role credentials.
 * Use this for server-side operations that need elevated permissions.
 */
export function createServiceClient(): SupabaseClient {
    const supabaseUrl = getSupabaseUrl();
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Create a Supabase client with user's auth token.
 * Use this for operations that should respect RLS policies.
 */
export function createUserClient(authHeader: string): SupabaseClient {
    const supabaseUrl = getSupabaseUrl();
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: { Authorization: authHeader },
        },
    });
}

/**
 * Validate a JWT token and return the user.
 * Returns null if validation fails.
 */
export async function validateUserToken(token: string): Promise<{ id: string; email?: string } | null> {
    const supabaseUrl = getSupabaseUrl();
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
        console.error('Supabase configuration missing');
        return null;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            console.error('Auth validation failed:', error?.message);
            return null;
        }
        return { id: user.id, email: user.email };
    } catch (err) {
        console.error('Auth error:', err);
        return null;
    }
}
