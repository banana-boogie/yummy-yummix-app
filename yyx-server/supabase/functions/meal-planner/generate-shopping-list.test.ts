import {
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { executeGenerateShoppingList } from "./generate-shopping-list.ts";

type QueryState = {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  value?: unknown;
  filters: Array<{ method: string; args: unknown[] }>;
};

function makeSupabase(options: { rpcError?: { message: string } } = {}) {
  const calls: QueryState[] = [];
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];

  const plan = {
    id: "plan-1",
    user_id: "user-1",
    shopping_list_id: null,
    shopping_sync_state: "not_created",
  };
  const slots = [
    {
      id: "slot-1",
      status: "planned",
      components: [{
        id: "component-1",
        recipe_id: "recipe-1",
        source_kind: "recipe",
      }],
    },
    {
      id: "slot-2",
      status: "planned",
      components: [{
        id: "component-2",
        recipe_id: "recipe-2",
        source_kind: "recipe",
      }],
    },
  ];
  const recipeIngredients = [
    {
      id: "ri-1",
      recipe_id: "recipe-1",
      ingredient_id: "ingredient-tomato",
      quantity: 2,
      measurement_unit_id: "g",
      optional: false,
    },
    {
      id: "ri-2",
      recipe_id: "recipe-2",
      ingredient_id: "ingredient-tomato",
      quantity: "3",
      measurement_unit_id: "g",
      optional: false,
    },
    {
      id: "ri-free",
      recipe_id: "recipe-2",
      ingredient_id: null,
      quantity: 1,
      measurement_unit_id: null,
      optional: false,
    },
  ];
  const ingredientRows = [{
    id: "ingredient-tomato",
    default_category_id: "produce",
  }];

  function build(table: string) {
    const state: QueryState = { table, op: "select", filters: [] };
    calls.push(state);
    const builder = {
      select: () => builder,
      eq: (...args: unknown[]) => {
        state.filters.push({ method: "eq", args });
        return builder;
      },
      in: (...args: unknown[]) => {
        state.filters.push({ method: "in", args });
        return builder;
      },
      not: (...args: unknown[]) => {
        state.filters.push({ method: "not", args });
        return builder;
      },
      insert: (value: unknown) => {
        state.op = "insert";
        state.value = value;
        return builder;
      },
      update: (value: unknown) => {
        state.op = "update";
        state.value = value;
        return builder;
      },
      delete: () => {
        state.op = "delete";
        return builder;
      },
      maybeSingle: () => {
        if (table === "meal_plans" && state.op === "select") {
          return Promise.resolve({ data: plan, error: null });
        }
        if (table === "shopping_lists") {
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      single: () => {
        if (table === "shopping_lists" && state.op === "insert") {
          return Promise.resolve({
            data: { id: "shopping-list-1" },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then: (resolve: (value: { data?: unknown; error: null }) => void) => {
        if (state.op !== "select") {
          resolve({ error: null });
          return;
        }
        if (table === "meal_plan_slots") {
          resolve({ data: slots, error: null });
          return;
        }
        if (table === "recipe_ingredients") {
          resolve({ data: recipeIngredients, error: null });
          return;
        }
        if (table === "ingredients") {
          resolve({ data: ingredientRows, error: null });
          return;
        }
        resolve({ data: [], error: null });
      },
    };
    return builder;
  }

  return {
    calls,
    rpcCalls,
    client: {
      from: (table: string) => build(table),
      rpc: (fn: string, args: Record<string, unknown>) => {
        rpcCalls.push({ fn, args });
        return Promise.resolve({ data: null, error: options.rpcError ?? null });
      },
    },
  };
}

Deno.test("generate_shopping_list creates a named list and atomically regenerates consolidated items", async () => {
  const { client, calls, rpcCalls } = makeSupabase();

  const result = await executeGenerateShoppingList(
    client as never,
    "user-1",
    "plan-1",
    "Lista de Mi Menú",
  );

  assertEquals(result.status, 200);
  assertEquals(result.response.shoppingListId, "shopping-list-1");
  assertEquals(result.response.warnings, ["SKIPPED_FREE_TEXT_INGREDIENTS:1"]);

  const createList = calls.find((c) =>
    c.table === "shopping_lists" && c.op === "insert"
  );
  assertEquals(createList?.value, {
    user_id: "user-1",
    name: "Lista de Mi Menú",
  });

  assertEquals(
    calls.some((c) => c.table === "shopping_list_items" && c.op === "delete"),
    false,
  );
  assertEquals(
    calls.some((c) => c.table === "shopping_list_items" && c.op === "insert"),
    false,
  );

  assertEquals(rpcCalls.length, 1);
  assertEquals(rpcCalls[0].fn, "regenerate_plan_shopping_list_items");
  assertEquals(rpcCalls[0].args.p_plan_id, "plan-1");
  assertEquals(rpcCalls[0].args.p_list_id, "shopping-list-1");
  const rows = rpcCalls[0].args.p_items as Array<Record<string, unknown>>;
  assertEquals(rows.length, 1);
  assertEquals(rows[0].ingredient_id, "ingredient-tomato");
  assertEquals(rows[0].category_id, "produce");
  assertEquals(rows[0].quantity, 5);
  assertEquals(rows[0].source_meal_plan_slot_id, "slot-1");
  assertEquals(rows[0].source_meal_plan_slot_component_id, "component-1");
  assertEquals("shopping_list_id" in rows[0], false);
  assertEquals("is_checked" in rows[0], false);

  const planUpdates = calls.filter((c) =>
    c.table === "meal_plans" && c.op === "update"
  );
  assertEquals(
    planUpdates.some((c) =>
      (c.value as Record<string, unknown>).shopping_list_id ===
        "shopping-list-1"
    ),
    true,
  );
  assertEquals(
    planUpdates.some((c) =>
      (c.value as Record<string, unknown>).shopping_sync_state === "current"
    ),
    false,
  );
});

Deno.test("generate_shopping_list returns 404 for another user's plan", async () => {
  const { client } = makeSupabase();

  const result = await executeGenerateShoppingList(
    client as never,
    "other-user",
    "plan-1",
  );

  assertEquals(result.status, 404);
  assertEquals(result.response.shoppingListId, null);
  assertStringIncludes(result.response.warnings.join(","), "PLAN_NOT_FOUND");
});

Deno.test("generate_shopping_list surfaces atomic regeneration RPC failures", async () => {
  const { client } = makeSupabase({
    rpcError: { message: "transaction failed" },
  });

  await assertRejects(
    () =>
      executeGenerateShoppingList(
        client as never,
        "user-1",
        "plan-1",
        "Shopping List",
      ),
    Error,
    "Regenerate shopping list failed: transaction failed",
  );
});
