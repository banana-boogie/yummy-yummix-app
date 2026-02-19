import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  buildGenerationBudgetExceededMessage,
  checkGenerationBudget,
  recordGenerationUsage,
} from "./generation-budget.ts";

type BudgetSupabase = Parameters<typeof checkGenerationBudget>[0];

type UsageRow = {
  generation_count: number;
  warning_80_sent_at: string | null;
  warning_90_sent_at: string | null;
};

function createMockSupabase(
  initialRow: UsageRow | null,
  opts?: { limit?: number },
) {
  let row = initialRow;
  const limit = opts?.limit ?? 10;

  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: row, error: null }),
          }),
        }),
      }),
      update: (payload: Record<string, unknown>) => {
        if (row) {
          row = { ...row, ...payload } as UsageRow;
        }
        return {
          eq: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      },
    }),
    rpc: (_fn: string, params: { p_user_id: string; p_limit: number }) => {
      if (!row) {
        // No row = first usage, create one
        row = {
          generation_count: 1,
          warning_80_sent_at: null,
          warning_90_sent_at: null,
        };
        return Promise.resolve({
          data: [{
            allowed: true,
            used: 1,
            was_80_warning_sent: false,
            was_90_warning_sent: false,
          }],
          error: null,
        });
      }

      const currentCount = row.generation_count;
      if (currentCount >= params.p_limit) {
        return Promise.resolve({
          data: [{
            allowed: false,
            used: currentCount,
            was_80_warning_sent: row.warning_80_sent_at !== null,
            was_90_warning_sent: row.warning_90_sent_at !== null,
          }],
          error: null,
        });
      }

      // Increment
      row = { ...row, generation_count: currentCount + 1 };
      return Promise.resolve({
        data: [{
          allowed: true,
          used: currentCount + 1,
          was_80_warning_sent: row.warning_80_sent_at !== null,
          was_90_warning_sent: row.warning_90_sent_at !== null,
        }],
        error: null,
      });
    },
    getRow: () => row,
  };
}

Deno.test("checkGenerationBudget allows usage when row does not exist", async () => {
  const supabase = createMockSupabase(null);
  const result = await checkGenerationBudget(
    supabase as unknown as BudgetSupabase,
    "user-1",
    10,
  );

  assertEquals(result.allowed, true);
  assertEquals(result.used, 0);
  assertEquals(result.limit, 10);
});

Deno.test("recordGenerationUsage increments count and emits 80% warning once", async () => {
  const supabase = createMockSupabase({
    generation_count: 7,
    warning_80_sent_at: null,
    warning_90_sent_at: null,
  });

  const result = await recordGenerationUsage(
    supabase as unknown as BudgetSupabase,
    "user-1",
    "en",
    10,
  );

  assertEquals(result.allowed, true);
  assertEquals(result.used, 8);
  assertEquals(result.warningLevel, 80);
  assertStringIncludes(result.warningMessage ?? "", "8 of 10");
  assertEquals(supabase.getRow()?.generation_count, 8);
});

Deno.test("recordGenerationUsage blocks when at monthly limit", async () => {
  const supabase = createMockSupabase({
    generation_count: 10,
    warning_80_sent_at: "2026-02-01T00:00:00.000Z",
    warning_90_sent_at: "2026-02-10T00:00:00.000Z",
  });

  const result = await recordGenerationUsage(
    supabase as unknown as BudgetSupabase,
    "user-1",
    "es",
    10,
  );

  assertEquals(result.allowed, false);
  assertEquals(result.used, 10);
  assertStringIncludes(result.warningMessage ?? "", "límite mensual");
});

Deno.test("buildGenerationBudgetExceededMessage includes reset framing", () => {
  const message = buildGenerationBudgetExceededMessage("en", "2026-03-01");
  assertStringIncludes(message, "monthly recipe creation limit");
  assertStringIncludes(message, "resets on");
});
