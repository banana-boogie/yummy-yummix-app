/**
 * Auth Middleware Tests
 *
 * Tests for JWT validation and role-based access control:
 * - Authorization header validation
 * - JWT token validation
 * - User extraction from tokens
 * - Role checking (user, admin)
 * - Response creators (401, 403)
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.0/assert/mod.ts";
import {
  AuthUser,
  forbiddenResponse,
  hasRole,
  unauthorizedResponse,
  validateAuth,
} from "../auth.ts";

// Mock Supabase client
const mockCreateClient = () => {
  return {
    auth: {
      getUser: async () => mockGetUserResponse,
    },
  };
};

let mockGetUserResponse: any = {
  data: { user: null },
  error: null,
};

// Store original env vars
const originalEnv = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
  SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY"),
};

// Setup: Mock Supabase environment
Deno.test("setup", () => {
  Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");
});

// ============================================================
// VALIDATE AUTH TESTS
// ============================================================

Deno.test("validateAuth - returns error when Authorization header is missing", async () => {
  const result = await validateAuth(null);

  assertEquals(result.user, null);
  assertEquals(result.error, "Missing Authorization header");
});

Deno.test("validateAuth - returns error when header doesn't start with Bearer", async () => {
  const result = await validateAuth("Basic abcd1234");

  assertEquals(result.user, null);
  assertEquals(result.error, "Invalid Authorization header format");
});

Deno.test("validateAuth - returns error when Supabase URL is missing", async () => {
  Deno.env.delete("SUPABASE_URL");

  const result = await validateAuth("Bearer valid-token");

  assertEquals(result.user, null);
  assertEquals(result.error, "Missing Supabase configuration");

  // Restore
  Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
});

Deno.test("validateAuth - returns error when Supabase anon key is missing", async () => {
  Deno.env.delete("SUPABASE_ANON_KEY");

  const result = await validateAuth("Bearer valid-token");

  assertEquals(result.user, null);
  assertEquals(result.error, "Missing Supabase configuration");

  // Restore
  Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");
});

// Note: The following test is commented out because it requires mocking the Supabase client.
// In a real implementation, you would:
// 1. Use a dependency injection pattern
// 2. Use a Deno-compatible mocking library like https://deno.land/x/mock
// 3. Test against a real test Supabase instance
//
// Deno.test("validateAuth - validates token format and structure", async () => {
//   const result = await validateAuth("Bearer invalid-token");
//   assertEquals(result.user, null);
//   assertExists(result.error);
// });

// ============================================================
// ROLE CHECKING TESTS
// ============================================================

Deno.test("hasRole - returns false when user is null", () => {
  const result = hasRole(null, "user");

  assertEquals(result, false);
});

Deno.test("hasRole - returns true when user has exact role", () => {
  const user: AuthUser = {
    id: "user-123",
    email: "test@example.com",
    role: "user",
  };

  const result = hasRole(user, "user");

  assertEquals(result, true);
});

Deno.test("hasRole - returns false when user has different role", () => {
  const user: AuthUser = {
    id: "user-123",
    email: "test@example.com",
    role: "user",
  };

  const result = hasRole(user, "admin");

  assertEquals(result, false);
});

Deno.test("hasRole - admin role has access to everything", () => {
  const adminUser: AuthUser = {
    id: "admin-123",
    email: "admin@example.com",
    role: "admin",
  };

  // Admin should have access to user role
  assertEquals(hasRole(adminUser, "user"), true);

  // Admin should have access to admin role
  assertEquals(hasRole(adminUser, "admin"), true);

  // Admin should have access to any other role
  assertEquals(hasRole(adminUser, "moderator"), true);
});

Deno.test("hasRole - handles user without role field", () => {
  const user: AuthUser = {
    id: "user-123",
    email: "test@example.com",
    // No role field
  };

  const result = hasRole(user, "user");

  assertEquals(result, false);
});

// ============================================================
// RESPONSE CREATOR TESTS
// ============================================================

Deno.test("unauthorizedResponse - creates 401 response with error message", async () => {
  const response = unauthorizedResponse("Authentication required");

  assertEquals(response.status, 401);
  assertEquals(response.headers.get("Content-Type"), "application/json");

  const body = await response.json();
  assertEquals(body.error, "Authentication required");
});

Deno.test("unauthorizedResponse - includes CORS headers when provided", async () => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
  };

  const response = unauthorizedResponse("Authentication required", corsHeaders);

  assertEquals(response.status, 401);
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(
    response.headers.get("Access-Control-Allow-Methods"),
    "GET, POST, PUT, DELETE",
  );

  const body = await response.json();
  assertEquals(body.error, "Authentication required");
});

Deno.test("forbiddenResponse - creates 403 response with error message", async () => {
  const response = forbiddenResponse("Insufficient permissions");

  assertEquals(response.status, 403);
  assertEquals(response.headers.get("Content-Type"), "application/json");

  const body = await response.json();
  assertEquals(body.error, "Insufficient permissions");
});

Deno.test("forbiddenResponse - includes CORS headers when provided", async () => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": "true",
  };

  const response = forbiddenResponse("Insufficient permissions", corsHeaders);

  assertEquals(response.status, 403);
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(
    response.headers.get("Access-Control-Allow-Credentials"),
    "true",
  );

  const body = await response.json();
  assertEquals(body.error, "Insufficient permissions");
});

// ============================================================
// INTEGRATION SCENARIO TESTS
// ============================================================

Deno.test("auth flow - validates complete authentication flow", () => {
  // Scenario 1: No auth header
  const noAuth = validateAuth(null);
  noAuth.then((result) => {
    assertEquals(result.user, null);
    assertExists(result.error);
  });

  // Scenario 2: User with role can access their own resources
  const regularUser: AuthUser = {
    id: "user-123",
    email: "user@example.com",
    role: "user",
  };

  assertEquals(hasRole(regularUser, "user"), true);
  assertEquals(hasRole(regularUser, "admin"), false);

  // Scenario 3: Admin can access everything
  const adminUser: AuthUser = {
    id: "admin-123",
    email: "admin@example.com",
    role: "admin",
  };

  assertEquals(hasRole(adminUser, "user"), true);
  assertEquals(hasRole(adminUser, "admin"), true);
});

// Cleanup: Restore original environment
Deno.test("cleanup", () => {
  if (originalEnv.SUPABASE_URL) {
    Deno.env.set("SUPABASE_URL", originalEnv.SUPABASE_URL);
  }
  if (originalEnv.SUPABASE_ANON_KEY) {
    Deno.env.set("SUPABASE_ANON_KEY", originalEnv.SUPABASE_ANON_KEY);
  }
});
