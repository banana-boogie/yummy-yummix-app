/**
 * Session Management Tests
 *
 * Covers session ownership validation, creation behavior, and title generation.
 */

import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { ensureSessionId, generateSessionTitle } from "./session.ts";
import { SessionOwnershipError } from "./types.ts";

type MockOptions = {
  existingSession?: { id: string } | null;
  validationError?: string;
  createdSessionId?: string;
  insertError?: string;
};

function createMockSupabase(options: MockOptions = {}) {
  const inserts: Array<Record<string, unknown>> = [];

  return {
    supabase: {
      from: (_table: string) => ({
        select: (_fields: string) => ({
          eq: (_colA: string, _valA: string) => ({
            eq: (_colB: string, _valB: string) => ({
              maybeSingle: async () => {
                if (options.validationError) {
                  return {
                    data: null,
                    error: { message: options.validationError },
                  };
                }
                return { data: options.existingSession ?? null, error: null };
              },
            }),
          }),
        }),
        insert: (payload: Record<string, unknown>) => {
          inserts.push(payload);
          return {
            select: (_fields: string) => ({
              single: async () => {
                if (options.insertError) {
                  return {
                    data: null,
                    error: { message: options.insertError },
                  };
                }
                return {
                  data: { id: options.createdSessionId ?? "new-session-id" },
                  error: null,
                };
              },
            }),
          };
        },
      }),
    },
    inserts,
  };
}

Deno.test("generateSessionTitle trims and preserves short messages", () => {
  const title = generateSessionTitle("   Make pasta tonight   ");
  assertEquals(title, "Make pasta tonight");
});

Deno.test("generateSessionTitle truncates long messages at a word boundary", () => {
  const title = generateSessionTitle(
    "Please create a simple chicken and rice dinner with vegetables for tonight",
  );
  assertEquals(title.endsWith("..."), true);
  assertEquals(title.length <= 53, true);
});

Deno.test("ensureSessionId returns provided session when ownership is valid", async () => {
  const { supabase, inserts } = createMockSupabase({
    existingSession: { id: "session-123" },
  });

  const result = await ensureSessionId(
    supabase as unknown as any,
    "user-1",
    "session-123",
    "hello",
  );

  assertEquals(result, { sessionId: "session-123", created: false });
  assertEquals(inserts.length, 0);
});

Deno.test("ensureSessionId throws SessionOwnershipError when session is missing", async () => {
  const { supabase } = createMockSupabase({ existingSession: null });

  await assertRejects(
    () =>
      ensureSessionId(
        supabase as unknown as any,
        "user-1",
        "missing-session",
      ),
    SessionOwnershipError,
    "Session not found or not owned by user",
  );
});

Deno.test("ensureSessionId creates a new session with generated title", async () => {
  const { supabase, inserts } = createMockSupabase({
    createdSessionId: "created-456",
  });

  const result = await ensureSessionId(
    supabase as unknown as any,
    "user-1",
    undefined,
    "  Make me a quick dinner with chicken and rice  ",
  );

  assertEquals(result, { sessionId: "created-456", created: true });
  assertEquals(inserts.length, 1);
  assertEquals(inserts[0].user_id, "user-1");
  assertEquals(
    inserts[0].title,
    "Make me a quick dinner with chicken and rice",
  );
});

Deno.test("ensureSessionId propagates insert failure", async () => {
  const { supabase } = createMockSupabase({ insertError: "insert failed" });

  await assertRejects(
    () =>
      ensureSessionId(
        supabase as unknown as any,
        "user-1",
        undefined,
        "first message",
      ),
    Error,
    "Failed to create chat session: insert failed",
  );
});
