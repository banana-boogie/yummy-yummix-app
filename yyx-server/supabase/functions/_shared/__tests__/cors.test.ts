/**
 * CORS Middleware Tests
 *
 * Tests for the CORS headers configuration used by edge functions:
 * - Headers structure and values
 * - Required headers for Supabase integration
 * - Usage patterns in OPTIONS preflight handling
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { corsHeaders } from "../cors.ts";

// ============================================================
// CORS HEADERS STRUCTURE TESTS
// ============================================================

Deno.test("corsHeaders - exports an object", () => {
  assertExists(corsHeaders);
  assertEquals(typeof corsHeaders, "object");
});

Deno.test("corsHeaders - has Access-Control-Allow-Origin header", () => {
  assertExists(corsHeaders["Access-Control-Allow-Origin"]);
});

Deno.test("corsHeaders - allows all origins with wildcard", () => {
  assertEquals(corsHeaders["Access-Control-Allow-Origin"], "*");
});

Deno.test("corsHeaders - has Access-Control-Allow-Headers header", () => {
  assertExists(corsHeaders["Access-Control-Allow-Headers"]);
});

// ============================================================
// REQUIRED HEADERS TESTS
// ============================================================

Deno.test("corsHeaders - allows authorization header", () => {
  const allowedHeaders = corsHeaders["Access-Control-Allow-Headers"]
    .toLowerCase();
  assertEquals(allowedHeaders.includes("authorization"), true);
});

Deno.test("corsHeaders - allows content-type header", () => {
  const allowedHeaders = corsHeaders["Access-Control-Allow-Headers"]
    .toLowerCase();
  assertEquals(allowedHeaders.includes("content-type"), true);
});

Deno.test("corsHeaders - allows apikey header for Supabase", () => {
  const allowedHeaders = corsHeaders["Access-Control-Allow-Headers"]
    .toLowerCase();
  assertEquals(allowedHeaders.includes("apikey"), true);
});

Deno.test("corsHeaders - allows x-client-info header for Supabase", () => {
  const allowedHeaders = corsHeaders["Access-Control-Allow-Headers"]
    .toLowerCase();
  assertEquals(allowedHeaders.includes("x-client-info"), true);
});

// ============================================================
// USAGE PATTERN TESTS
// ============================================================

Deno.test("corsHeaders - can be spread into Response headers", () => {
  const response = new Response("test", {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(response.headers.get("Content-Type"), "application/json");
});

Deno.test("corsHeaders - works with OPTIONS preflight response", () => {
  const response = new Response("ok", {
    status: 200,
    headers: corsHeaders,
  });

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("corsHeaders - can be used in multiple responses", () => {
  const response1 = new Response("first", { headers: corsHeaders });
  const response2 = new Response("second", { headers: corsHeaders });

  // Both responses should have the same CORS headers
  assertEquals(
    response1.headers.get("Access-Control-Allow-Origin"),
    response2.headers.get("Access-Control-Allow-Origin"),
  );
  assertEquals(
    response1.headers.get("Access-Control-Allow-Headers"),
    response2.headers.get("Access-Control-Allow-Headers"),
  );
});

// ============================================================
// INTEGRATION PATTERN TESTS
// ============================================================

Deno.test("corsHeaders - typical preflight handler pattern", async () => {
  // Simulate a preflight request handler
  function handlePreflight(): Response {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const response = handlePreflight();
  const body = await response.text();

  assertEquals(response.status, 200);
  assertEquals(body, "ok");
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("corsHeaders - typical JSON response pattern", async () => {
  // Simulate a typical JSON response with CORS headers
  function createJsonResponse(data: unknown): Response {
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 200,
    });
  }

  const response = createJsonResponse({ message: "success" });
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.message, "success");
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(response.headers.get("Content-Type"), "application/json");
});

Deno.test("corsHeaders - typical error response pattern", async () => {
  // Simulate an error response with CORS headers (important for frontend error handling)
  function createErrorResponse(message: string, status: number): Response {
    return new Response(JSON.stringify({ error: message }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status,
    });
  }

  const response = createErrorResponse("Not found", 404);
  const body = await response.json();

  assertEquals(response.status, 404);
  assertEquals(body.error, "Not found");
  // CORS headers should still be present on error responses
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
});
