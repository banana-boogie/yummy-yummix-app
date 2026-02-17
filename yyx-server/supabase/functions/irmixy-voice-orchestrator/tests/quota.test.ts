import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { getQuotaLimitForUser } from "../quota.ts";

interface QuotaRow {
  monthly_minutes_limit: number;
  expires_at: string | null;
}

function createMockQuotaClient(row: QuotaRow | null) {
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
