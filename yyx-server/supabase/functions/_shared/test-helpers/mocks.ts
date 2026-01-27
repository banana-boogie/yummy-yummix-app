/**
 * Deno Test Mocks and Helpers
 *
 * Provides utilities for testing Supabase Edge Functions.
 *
 * FOR AI AGENTS:
 * - Use createMockRequest() to create HTTP request objects
 * - Use mockEnv() to set up environment variables
 * - Use createMockSupabaseClient() for Supabase interactions
 * - Always clean up with cleanupEnv() in test teardown
 *
 * @example
 * ```typescript
 * import { assertEquals } from 'std/assert/mod.ts';
 * import { createMockRequest, mockEnv, cleanupEnv } from '../_shared/test-helpers/mocks.ts';
 *
 * Deno.test('handles POST request', async () => {
 *   mockEnv({ SUPABASE_URL: 'http://localhost:54321' });
 *
 *   const req = createMockRequest({ message: 'Hello' });
 *   // ... test code
 *
 *   cleanupEnv(['SUPABASE_URL']);
 * });
 * ```
 */

// ============================================================
// REQUEST MOCKING
// ============================================================

/**
 * Creates a mock Request object for testing Edge Functions.
 *
 * @param body - JSON body to include in the request
 * @param options - Additional request options
 * @returns A Request object suitable for Edge Function handlers
 *
 * @example
 * ```typescript
 * // Basic POST request with JSON body
 * const req = createMockRequest({ message: 'Hello' });
 *
 * // GET request
 * const getReq = createMockRequest(null, { method: 'GET' });
 *
 * // Request with auth header
 * const authReq = createMockRequest(
 *   { message: 'Hello' },
 *   { headers: { Authorization: 'Bearer test-token' } }
 * );
 * ```
 */
export function createMockRequest(
  body?: unknown,
  options?: {
    method?: string;
    headers?: Record<string, string>;
    url?: string;
  },
): Request {
  const {
    method = "POST",
    headers = {},
    url = "https://test.supabase.co/functions/v1/test",
  } = options || {};

  const requestInit: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body !== null && body !== undefined && method !== "GET") {
    requestInit.body = JSON.stringify(body);
  }

  return new Request(url, requestInit);
}

/**
 * Creates a mock Request with authentication header.
 */
export function createAuthenticatedRequest(
  body?: unknown,
  token = "test-jwt-token",
  options?: { method?: string; headers?: Record<string, string> },
): Request {
  return createMockRequest(body, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Creates a mock FormData request (for multipart uploads).
 */
export function createFormDataRequest(
  formData: FormData,
  options?: { headers?: Record<string, string> },
): Request {
  return new Request("https://test.supabase.co/functions/v1/test", {
    method: "POST",
    body: formData,
    headers: options?.headers,
  });
}

// ============================================================
// ENVIRONMENT MOCKING
// ============================================================

/**
 * Sets environment variables for testing.
 *
 * @param env - Object with environment variable names and values
 *
 * @example
 * ```typescript
 * mockEnv({
 *   SUPABASE_URL: 'http://localhost:54321',
 *   SUPABASE_ANON_KEY: 'test-anon-key',
 *   OPENAI_API_KEY: 'sk-test-key',
 * });
 * ```
 */
export function mockEnv(env: Record<string, string>): void {
  for (const [key, value] of Object.entries(env)) {
    Deno.env.set(key, value);
  }
}

/**
 * Removes environment variables after test.
 *
 * @param keys - Array of environment variable names to remove
 */
export function cleanupEnv(keys: string[]): void {
  for (const key of keys) {
    Deno.env.delete(key);
  }
}

/**
 * Sets up standard Supabase environment variables for testing.
 */
export function mockSupabaseEnv(): void {
  mockEnv({
    SUPABASE_URL: "http://localhost:54321",
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  });
}

/**
 * Cleans up Supabase environment variables.
 */
export function cleanupSupabaseEnv(): void {
  cleanupEnv([
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);
}

// ============================================================
// SUPABASE CLIENT MOCKING
// ============================================================

/**
 * Creates a mock Supabase client for testing.
 * Use this when you need to test code that uses the Supabase client.
 */
export function createMockSupabaseClient() {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
          then: (resolve: (result: { data: unknown[]; error: null }) => void) =>
            resolve({ data: [], error: null }),
        }),
        order: () => ({
          limit: () => ({
            then: (
              resolve: (result: { data: unknown[]; error: null }) => void,
            ) => resolve({ data: [], error: null }),
          }),
        }),
        then: (resolve: (result: { data: unknown[]; error: null }) => void) =>
          resolve({ data: [], error: null }),
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
        then: (resolve: (result: { data: null; error: null }) => void) =>
          resolve({ data: null, error: null }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
          then: (resolve: (result: { data: null; error: null }) => void) =>
            resolve({ data: null, error: null }),
        }),
      }),
      delete: () => ({
        eq: () => Promise.resolve({ data: null, error: null }),
      }),
    }),
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: { id: "test-user-id", email: "test@example.com" } },
          error: null,
        }),
    },
    storage: {
      from: () => ({
        upload: () =>
          Promise.resolve({ data: { path: "test/path" }, error: null }),
        download: () => Promise.resolve({ data: new Blob(), error: null }),
        getPublicUrl: () => ({
          data: { publicUrl: "https://test.com/image.jpg" },
        }),
      }),
    },
    functions: {
      invoke: () => Promise.resolve({ data: null, error: null }),
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
  };
}

// ============================================================
// RESPONSE HELPERS
// ============================================================

/**
 * Creates a mock successful JSON response.
 */
export function createMockJsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Creates a mock error response.
 */
export function createMockErrorResponse(
  message: string,
  status = 400,
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ============================================================
// FETCH MOCKING
// ============================================================

/**
 * Creates a fetch mock that returns the specified response.
 * Use this to mock external API calls (OpenAI, USDA, etc.).
 *
 * @example
 * ```typescript
 * const originalFetch = globalThis.fetch;
 * globalThis.fetch = createMockFetch({ response: 'Hello from AI' });
 *
 * // ... run test
 *
 * globalThis.fetch = originalFetch;
 * ```
 */
export function createMockFetch(
  responseData: unknown,
  options?: { status?: number; headers?: Record<string, string> },
): typeof fetch {
  return () =>
    Promise.resolve(
      new Response(JSON.stringify(responseData), {
        status: options?.status || 200,
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      }),
    );
}

/**
 * Creates a fetch mock that simulates an error.
 */
export function createMockFetchError(message: string): typeof fetch {
  return () => Promise.reject(new Error(message));
}

// ============================================================
// TEST DATA GENERATORS
// ============================================================

/**
 * Generates a random UUID for testing.
 */
export function generateTestId(): string {
  return crypto.randomUUID();
}

/**
 * Generates a random email for testing.
 */
export function generateTestEmail(): string {
  return `test-${Math.random().toString(36).substr(2, 9)}@example.com`;
}

/**
 * Creates a delay (useful for testing async behavior).
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
