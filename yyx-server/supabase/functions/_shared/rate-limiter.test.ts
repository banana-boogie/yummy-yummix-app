import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { checkRateLimit } from "./rate-limiter.ts";

type RateLimitSupabase = Parameters<typeof checkRateLimit>[0];

Deno.test("checkRateLimit allows requests when under limit", async () => {
  let rpcName = "";
  const supabase = {
    rpc: (name: string) => {
      rpcName = name;
      return Promise.resolve({
        data: [{ allowed: true, retry_after_ms: null }],
        error: null,
      });
    },
  } as unknown as RateLimitSupabase;

  const result = await checkRateLimit(supabase, "user-1");
  assertEquals(result, { allowed: true });
  assertEquals(rpcName, "check_and_increment_ai_chat_rate_limit");
});

Deno.test("checkRateLimit blocks requests when limit is exceeded", async () => {
  const supabase = {
    rpc: () => Promise.resolve({
      data: [{ allowed: false, retry_after_ms: 42500 }],
      error: null,
    }),
  } as unknown as RateLimitSupabase;

  const result = await checkRateLimit(supabase, "user-1");
  assertEquals(result.allowed, false);
  assertEquals(result.retryAfterMs, 42500);
});

Deno.test("checkRateLimit fails open when RPC errors", async () => {
  const supabase = {
    rpc: () => Promise.resolve({
      data: null,
      error: { message: "db down" },
    }),
  } as unknown as RateLimitSupabase;

  const result = await checkRateLimit(supabase, "user-1");
  assertEquals(result, { allowed: true });
});

Deno.test("checkRateLimit fails open on unexpected payload", async () => {
  const supabase = {
    rpc: () => Promise.resolve({
      data: [{ allowed: "yes" }],
      error: null,
    }),
  } as unknown as RateLimitSupabase;

  const result = await checkRateLimit(supabase, "user-1");
  assertEquals(result, { allowed: true });
});
