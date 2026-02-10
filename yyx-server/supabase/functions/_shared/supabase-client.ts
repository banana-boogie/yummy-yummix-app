/**
 * Supabase Client Factory
 *
 * Creates Supabase clients for edge functions.
 */

import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Get the Supabase URL from environment.
 */
export function getSupabaseUrl(): string {
  return Deno.env.get("SUPABASE_URL") || "";
}

/**
 * Create a Supabase client with service role credentials.
 * Use this for server-side operations that need elevated permissions.
 */
export function createServiceClient(): SupabaseClient {
  const supabaseUrl = getSupabaseUrl();
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Create a Supabase client with user's auth token.
 * Use this for operations that should respect RLS policies.
 */
export function createUserClient(authHeader: string): SupabaseClient {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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
export async function validateUserToken(
  token: string,
): Promise<{ id: string; email?: string } | null> {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase configuration missing");
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.error("Auth validation failed:", error?.message);
      return null;
    }
    return { id: user.id, email: user.email };
  } catch (err) {
    console.error("Auth error:", err);
    return null;
  }
}
