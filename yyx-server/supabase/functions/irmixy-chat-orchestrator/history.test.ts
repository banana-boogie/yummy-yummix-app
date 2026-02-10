/**
 * History Management Tests
 *
 * Verifies persistence payload shape and error propagation for saveMessageToHistory.
 */

import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";
import type { IrmixyResponse } from "../_shared/irmixy-schemas.ts";
import { saveMessageToHistory } from "./history.ts";

type MockSupabase = {
  from: (table: string) => {
    insert: (payload: unknown) => Promise<{ data: null; error: null }>;
  };
};

function createMockSupabase(options?: { throwOnInsertCall?: number }): {
  supabase: MockSupabase;
  inserts: unknown[];
  tables: string[];
} {
  let insertCallCount = 0;
  const inserts: unknown[] = [];
  const tables: string[] = [];

  return {
    supabase: {
      from: (table: string) => {
        tables.push(table);
        return {
          insert: async (payload: unknown) => {
            insertCallCount += 1;
            if (options?.throwOnInsertCall === insertCallCount) {
              throw new Error("insert failed");
            }
            inserts.push(payload);
            return { data: null, error: null };
          },
        };
      },
    },
    inserts,
    tables,
  };
}

function createResponse(): IrmixyResponse {
  return {
    version: "1.0",
    message: "Assistant response",
    language: "en",
    status: null,
    suggestions: [
      { label: "Show more options", message: "Show more options" },
    ],
  };
}

Deno.test("saveMessageToHistory - inserts user then assistant payloads", async () => {
  const { supabase, inserts, tables } = createMockSupabase();
  const response = createResponse();

  await saveMessageToHistory(
    supabase as unknown as any,
    "session-123",
    "User message",
    response,
  );

  assertEquals(tables, ["user_chat_messages", "user_chat_messages"]);
  assertEquals(inserts.length, 2);
  assertEquals(inserts[0], {
    session_id: "session-123",
    role: "user",
    content: "User message",
  });
  assertEquals(inserts[1], {
    session_id: "session-123",
    role: "assistant",
    content: "Assistant response",
    tool_calls: {
      suggestions: response.suggestions,
    },
  });
});

Deno.test("saveMessageToHistory - propagates insert failure", async () => {
  const { supabase } = createMockSupabase({ throwOnInsertCall: 1 });

  await assertRejects(
    () =>
      saveMessageToHistory(
        supabase as unknown as any,
        "session-123",
        "User message",
        createResponse(),
      ),
    Error,
    "insert failed",
  );
});

