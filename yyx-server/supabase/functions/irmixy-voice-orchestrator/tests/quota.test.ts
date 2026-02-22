import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { getDefaultVoiceQuotaMinutes, getQuotaLimitForUser } from "../quota.ts";

interface QuotaRow {
  monthly_minutes_limit: number;
  expires_at: string | null;
}

// deno-lint-ignore no-explicit-any
function createMockQuotaClient(row: QuotaRow | null): any {
  return {
    from: (table: string) => ({
      select: (_columns: string) => ({
        eq: (_column: string, _userId: string) => ({
          single: async () => {
            if (table !== "voice_quotas") {
              throw new Error("Unexpected table");
            }
            return {
              data: row,
              error: row ? null : { message: "No rows found" },
            };
          },
        }),
      }),
    }),
  };
}

Deno.test("getQuotaLimitForUser returns default when no override exists", async () => {
  const client = createMockQuotaClient(null);

  const result = await getQuotaLimitForUser(client, "user-id-1", 30);

  assertEquals(result, 30);
});

Deno.test("getQuotaLimitForUser returns custom limit for active override", async () => {
  const client = createMockQuotaClient({
    monthly_minutes_limit: 45,
    expires_at: null,
  });

  const result = await getQuotaLimitForUser(client, "user-id-1", 30);

  assertEquals(result, 45);
});

Deno.test("getQuotaLimitForUser returns default when override is expired", async () => {
  const client = createMockQuotaClient({
    monthly_minutes_limit: 45,
    expires_at: "2020-01-01T00:00:00.000Z",
  });

  const result = await getQuotaLimitForUser(client, "user-id-1", 30);

  assertEquals(result, 30);
});

// ============================================================
// getDefaultVoiceQuotaMinutes
// ============================================================

Deno.test("getDefaultVoiceQuotaMinutes returns 30 when env var is not set", () => {
  const original = Deno.env.get("DEFAULT_VOICE_QUOTA_MINUTES");
  Deno.env.delete("DEFAULT_VOICE_QUOTA_MINUTES");

  const result = getDefaultVoiceQuotaMinutes();
  assertEquals(result, 30);

  if (original !== undefined) {
    Deno.env.set("DEFAULT_VOICE_QUOTA_MINUTES", original);
  }
});

Deno.test("getDefaultVoiceQuotaMinutes reads custom value from env", () => {
  const original = Deno.env.get("DEFAULT_VOICE_QUOTA_MINUTES");
  Deno.env.set("DEFAULT_VOICE_QUOTA_MINUTES", "60");

  const result = getDefaultVoiceQuotaMinutes();
  assertEquals(result, 60);

  if (original !== undefined) {
    Deno.env.set("DEFAULT_VOICE_QUOTA_MINUTES", original);
  } else {
    Deno.env.delete("DEFAULT_VOICE_QUOTA_MINUTES");
  }
});

Deno.test("getDefaultVoiceQuotaMinutes returns fallback for non-numeric env var", () => {
  const original = Deno.env.get("DEFAULT_VOICE_QUOTA_MINUTES");
  Deno.env.set("DEFAULT_VOICE_QUOTA_MINUTES", "abc");

  const result = getDefaultVoiceQuotaMinutes();
  assertEquals(result, 30);

  if (original !== undefined) {
    Deno.env.set("DEFAULT_VOICE_QUOTA_MINUTES", original);
  } else {
    Deno.env.delete("DEFAULT_VOICE_QUOTA_MINUTES");
  }
});

Deno.test("getDefaultVoiceQuotaMinutes returns fallback for zero", () => {
  const original = Deno.env.get("DEFAULT_VOICE_QUOTA_MINUTES");
  Deno.env.set("DEFAULT_VOICE_QUOTA_MINUTES", "0");

  const result = getDefaultVoiceQuotaMinutes();
  assertEquals(result, 30);

  if (original !== undefined) {
    Deno.env.set("DEFAULT_VOICE_QUOTA_MINUTES", original);
  } else {
    Deno.env.delete("DEFAULT_VOICE_QUOTA_MINUTES");
  }
});

Deno.test("getDefaultVoiceQuotaMinutes returns fallback for negative value", () => {
  const original = Deno.env.get("DEFAULT_VOICE_QUOTA_MINUTES");
  Deno.env.set("DEFAULT_VOICE_QUOTA_MINUTES", "-5");

  const result = getDefaultVoiceQuotaMinutes();
  assertEquals(result, 30);

  if (original !== undefined) {
    Deno.env.set("DEFAULT_VOICE_QUOTA_MINUTES", original);
  } else {
    Deno.env.delete("DEFAULT_VOICE_QUOTA_MINUTES");
  }
});
