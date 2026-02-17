/**
 * Auth Middleware
 *
 * Validates Supabase JWT tokens and extracts user information.
 * Supports role-based access control.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
}

export interface AuthResult {
  user: AuthUser | null;
  error: string | null;
}

/**
 * Validate the Authorization header and return user info.
 *
 * @param authHeader - The Authorization header value (e.g., "Bearer <token>")
 * @returns AuthResult with user info or error
 */
export async function validateAuth(
  authHeader: string | null,
): Promise<AuthResult> {
  if (!authHeader) {
    return { user: null, error: "Missing Authorization header" };
  }

  if (!authHeader.startsWith("Bearer ")) {
    return { user: null, error: "Invalid Authorization header format" };
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return { user: null, error: "Missing Supabase configuration" };
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    // Pass token directly to getUser() for edge function environments
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return { user: null, error: error?.message ?? "Invalid token" };
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.app_metadata?.role ?? "user",
      },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { user: null, error: `Auth validation failed: ${message}` };
  }
}

/**
 * Check if the user has the required role.
 */
export function hasRole(user: AuthUser | null, requiredRole: string): boolean {
  if (!user) return false;

  // Admin role has access to everything
  if (user.role === "admin") return true;

  return user.role === requiredRole;
}

/**
 * Create an unauthorized response.
 */
export function unauthorizedResponse(
  message: string,
  corsHeaders: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    },
  );
}

/**
 * Create a forbidden response.
 */
export function forbiddenResponse(
  message: string,
  corsHeaders: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    },
  );
}
