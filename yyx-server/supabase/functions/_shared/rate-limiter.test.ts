import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { checkRateLimit } from "./rate-limiter.ts";

Deno.test("checkRateLimit allows requests when under limit", async () => {
  const supabase = {
    rpc: async () => ({
      data: [{ allowed: true, retry_after_ms: null }],
      error: null,
    }),
  } as any;

  const result = await checkRateLimit(supabase, "user-1");
  assertEquals(result, { allowed: true });
});

Deno.test("checkRateLimit blocks requests when limit is exceeded", async () => {
  const supabase = {
    rpc: async () => ({
      data: [{ allowed: false, retry_after_ms: 42500 }],
      error: null,
    }),
  } as any;

  const result = await checkRateLimit(supabase, "user-1");
  assertEquals(result.allowed, false);
  assertEquals(result.retryAfterMs, 42500);
});

Deno.test("checkRateLimit fails open when RPC errors", async () => {
  const supabase = {
    rpc: async () => ({
      data: null,
      error: { message: "db down" },
    }),
  } as any;

  const result = await checkRateLimit(supabase, "user-1");
  assertEquals(result, { allowed: true });
});

Deno.test("checkRateLimit fails open on unexpected payload", async () => {
  const supabase = {
    rpc: async () => ({
      data: [{ allowed: "yes" }],
      error: null,
    }),
  } as any;

  const result = await checkRateLimit(supabase, "user-1");
  assertEquals(result, { allowed: true });
});
