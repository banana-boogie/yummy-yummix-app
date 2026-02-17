import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

interface RateLimitOptions {
  limit?: number;
  windowSeconds?: number;
}

const DEFAULT_LIMIT = 20;
const DEFAULT_WINDOW_SECONDS = 60;

/**
 * Check and increment per-user chat rate limits.
 * Fails open on RPC errors to avoid full request outages.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  options?: RateLimitOptions,
): Promise<RateLimitResult> {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const windowSeconds = options?.windowSeconds ?? DEFAULT_WINDOW_SECONDS;

  try {
    const { data, error } = await supabase.rpc(
      "check_and_increment_chat_rate_limit",
      {
        p_user_id: userId,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      },
    );

    if (error) {
      console.warn("[rate-limiter] RPC failed, allowing request", {
        message: error.message,
      });
      return { allowed: true };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.allowed !== "boolean") {
      console.warn("[rate-limiter] Unexpected RPC payload, allowing request");
      return { allowed: true };
    }

    if (row.allowed) {
      return { allowed: true };
    }

    return {
      allowed: false,
      retryAfterMs: typeof row.retry_after_ms === "number"
        ? row.retry_after_ms
        : undefined,
    };
  } catch (error) {
    console.warn("[rate-limiter] Exception, allowing request", {
      message: error instanceof Error ? error.message : String(error),
    });
    return { allowed: true };
  }
}
