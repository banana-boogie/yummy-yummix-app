/**
 * plan-context tests
 *
 * Verifies the `todayLocalDate` override so that users in UTC-negative zones
 * (e.g. Mexico) keep same-day meals in `nextMeal` when UTC has already
 * rolled over.
 */

import { assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { loadPlanContext } from "../plan-context.ts";

interface SlotRow {
  id: string;
  planned_date: string;
  day_index: number;
  meal_type: string;
  meal_plan_slot_components: Array<{
    title_snapshot: string | null;
    is_primary: boolean | null;
    display_order: number | null;
  }>;
}

/**
 * Minimal supabase-client stub covering the two tables `loadPlanContext`
 * touches: `meal_plans` (single active plan lookup) and `meal_plan_slots`
 * (date-filtered slot list). Captures the `.gte("planned_date", ...)`
 * argument so tests can assert what the function queried for.
 */
function createSupabaseStub(slotRows: SlotRow[]) {
  const captured: { plannedDateFilter: string | null } = {
    plannedDateFilter: null,
  };

  function slotsBuilder(): unknown {
    const builder = {
      select: () => builder,
      eq: () => builder,
      gte: (_column: string, value: string) => {
        captured.plannedDateFilter = value;
        // Re-apply the filter so the response matches what Postgres would.
        const filtered = slotRows.filter((row) => row.planned_date >= value);
        const ordered = [...filtered].sort((a, b) =>
          a.planned_date.localeCompare(b.planned_date)
        );
        const limited = {
          limit: (n: number) => ({
            data: ordered.slice(0, n),
            error: null,
          }),
        };
        // Chain pattern: .order().order().limit()
        const orderChain = {
          order: () => orderChain,
          limit: limited.limit,
        };
        return orderChain;
      },
    };
    return builder;
  }

  const supabase = {
    from: (table: string) => {
      if (table === "meal_plans") {
        const builder = {
          select: () => builder,
          eq: () => builder,
          order: () => builder,
          limit: () => builder,
          maybeSingle: () => ({
            data: { id: "plan-1", week_start: "2026-04-13" },
            error: null,
          }),
        };
        return builder;
      }
      if (table === "meal_plan_slots") {
        return slotsBuilder();
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };

  return { supabase, captured };
}

Deno.test("loadPlanContext uses todayLocalDate to pick same-day meal", async () => {
  const slots: SlotRow[] = [
    {
      id: "slot-today",
      planned_date: "2026-04-13",
      day_index: 0,
      meal_type: "dinner",
      meal_plan_slot_components: [
        { title_snapshot: "Tacos", is_primary: true, display_order: 0 },
      ],
    },
    {
      id: "slot-tomorrow",
      planned_date: "2026-04-14",
      day_index: 1,
      meal_type: "breakfast",
      meal_plan_slot_components: [
        { title_snapshot: "Oats", is_primary: true, display_order: 0 },
      ],
    },
  ];
  const { supabase, captured } = createSupabaseStub(slots);

  const context = await loadPlanContext(
    supabase as unknown as Parameters<typeof loadPlanContext>[0],
    "user-1",
    "2026-04-13",
  );

  assertEquals(captured.plannedDateFilter, "2026-04-13");
  assertEquals(context?.nextMeal?.plannedDate, "2026-04-13");
  assertEquals(context?.nextMeal?.title, "Tacos");
});

Deno.test("loadPlanContext ignores malformed todayLocalDate and falls back to UTC", async () => {
  const slots: SlotRow[] = [];
  const { supabase, captured } = createSupabaseStub(slots);

  await loadPlanContext(
    supabase as unknown as Parameters<typeof loadPlanContext>[0],
    "user-1",
    "not-a-date",
  );

  // Fallback uses UTC today (YYYY-MM-DD). We just assert the shape.
  assertEquals(
    /^\d{4}-\d{2}-\d{2}$/.test(captured.plannedDateFilter ?? ""),
    true,
  );
  assertEquals(captured.plannedDateFilter === "not-a-date", false);
});
