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

function createMockSupabase(initialRow: UsageRow | null) {
  let row = initialRow;

  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: row, error: null }),
          }),
        }),
      }),
      upsert: (payload: Record<string, unknown>) => {
        row = {
          generation_count: Number(payload.generation_count ?? 0),
          warning_80_sent_at: (payload.warning_80_sent_at as string) ?? null,
          warning_90_sent_at: (payload.warning_90_sent_at as string) ?? null,
        };
        return Promise.resolve({ error: null });
      },
    }),
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
