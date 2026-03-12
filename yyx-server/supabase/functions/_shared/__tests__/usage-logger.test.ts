import {
  assertAlmostEquals,
  assertEquals,
  assertExists,
  assertRejects,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";
import {
  estimateCostUsd,
  logAIUsage,
  logAIUsageWithClient,
  PRICING_VERSION,
  sanitizeMetadata,
} from "../usage-logger.ts";

Deno.test("estimateCostUsd returns expected cost for known model", () => {
  const cost = estimateCostUsd("gemini-2.5-flash", 1000, 2000);
  // 1000 * 0.15/1M + 2000 * 0.60/1M = 0.00135
  assertAlmostEquals(cost, 0.00135, 1e-12);
});

Deno.test("estimateCostUsd returns fallback cost for unknown model", () => {
  // Unknown model falls back to most expensive (gpt-4.1: 2.00 + 8.00)
  const cost = estimateCostUsd("unknown-model", 1000, 1000);
  assertExists(cost);
  // 1000/1M * 2.00 + 1000/1M * 8.00 = 0.01
  assertAlmostEquals(cost, 0.01, 1e-8);
});

Deno.test("sanitizeMetadata keeps only allowlisted keys", () => {
  const result = sanitizeMetadata({
    streaming: true,
    tool_names: ["search_recipes", 42, "generate_custom_recipe"],
    request_type: "chat",
    prompt: "should be removed",
    content: "should be removed",
  });

  assertEquals(result.streaming, true);
  assertEquals(result.request_type, "chat");
  assertEquals(
    result.tool_names,
    ["search_recipes", "generate_custom_recipe"],
  );
  assertEquals((result as Record<string, unknown>).prompt, undefined);
  assertEquals((result as Record<string, unknown>).content, undefined);
});

Deno.test("logAIUsageWithClient builds row and uses conflict-safe upsert", async () => {
  let tableName = "";
  let upsertPayload: Record<string, unknown> | undefined;
  let upsertOptions: Record<string, unknown> | undefined;

  const mockClient = {
    from: (table: string) => {
      tableName = table;
      return {
        upsert: (
          payload: Record<string, unknown>,
          options: Record<string, unknown>,
        ) => {
          upsertPayload = payload;
          upsertOptions = options;
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  await logAIUsageWithClient(mockClient as any, {
    userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    sessionId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    requestId: "req_test",
    callPhase: "tool_decision",
    functionName: "irmixy-chat-orchestrator",
    usageType: "text",
    model: "gemini-2.5-flash",
    inputTokens: 100,
    outputTokens: 200,
    durationMs: 123,
    metadata: {
      streaming: false,
      request_type: "tool_decision",
      prompt: "redacted",
    },
  });

  assertEquals(tableName, "ai_usage_logs");
  assertExists(upsertPayload);
  assertExists(upsertOptions);

  const payload = upsertPayload as Record<string, unknown>;
  const options = upsertOptions as Record<string, unknown>;

  assertEquals(payload["request_id"], "req_test");
  assertEquals(payload["call_phase"], "tool_decision");
  assertEquals(payload["pricing_version"], PRICING_VERSION);
  assertEquals(payload["model"], "gemini-2.5-flash");
  // 100/1M * 0.15 + 200/1M * 0.60 = 0.000135
  assertAlmostEquals(payload["estimated_cost_usd"] as number, 0.000135, 1e-8);
  assertEquals(
    payload["metadata"],
    { streaming: false, request_type: "tool_decision" },
  );
  assertEquals(options["onConflict"], "request_id,call_phase,attempt");
  assertEquals(options["ignoreDuplicates"], true);
});

Deno.test("logAIUsageWithClient throws when client returns error", async () => {
  const mockClient = {
    from: () => ({
      upsert: () => Promise.resolve({ error: new Error("insert failed") }),
    }),
  };

  await assertRejects(
    () =>
      logAIUsageWithClient(mockClient as any, {
        userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        requestId: "req_fail",
        callPhase: "response_stream",
        functionName: "irmixy-chat-orchestrator",
        usageType: "text",
      }),
    Error,
  );
});

Deno.test("logAIUsage never throws even with missing env configuration", async () => {
  await logAIUsage({
    userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    requestId: "req_noop",
    callPhase: "response_stream",
    functionName: "irmixy-chat-orchestrator",
    usageType: "text",
    status: "error",
  });
});
