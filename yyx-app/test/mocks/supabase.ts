/**
 * Supabase Mock Utilities
 *
 * Provides helper functions for mocking Supabase client behavior in tests.
 *
 * FOR AI AGENTS:
 * - Use these helpers to set up specific Supabase states in tests
 * - Always reset mocks between tests using jest.clearAllMocks()
 * - The base mock is set up in jest.setup.js, these helpers modify it
 *
 * @example
 * ```typescript
 * import { mockSupabaseAuthSuccess, mockDatabaseQuery } from '@/test/mocks/supabase';
 * import { userFactory } from '@/test/factories';
 *
 * describe('MyComponent', () => {
 *   beforeEach(() => {
 *     jest.clearAllMocks();
 *   });
 *
 *   it('shows user name when authenticated', () => {
 *     const user = userFactory.createSupabaseUser();
 *     mockSupabaseAuthSuccess(user);
 *     // ... test code
 *   });
 * });
 * ```
 */

import type { User, Session, AuthError } from '@supabase/supabase-js';

// ============================================================
// TYPES
// ============================================================

export interface MockSupabaseClient {
  auth: {
    getSession: jest.Mock;
    getUser: jest.Mock;
    signInWithPassword: jest.Mock;
    signInWithOtp: jest.Mock;
    signOut: jest.Mock;
    onAuthStateChange: jest.Mock;
    setSession: jest.Mock;
    startAutoRefresh: jest.Mock;
    stopAutoRefresh: jest.Mock;
  };
  from: jest.Mock;
  storage: {
    from: jest.Mock;
  };
  functions: {
    invoke: jest.Mock;
  };
  rpc: jest.Mock;
}

// ============================================================
// HELPER TO GET MOCK CLIENT
// ============================================================

/**
 * Gets the mocked Supabase client from the jest mock.
 * Use this to access and configure the mock in tests.
 */
export function getMockSupabaseClient(): MockSupabaseClient {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { supabase } = require('@/lib/supabase');
  return supabase as MockSupabaseClient;
}

// ============================================================
// AUTH HELPERS
// ============================================================

/**
 * Creates a mock Supabase User object.
 *
 * FOR AI AGENTS: Prefer using userFactory.createSupabaseUser() which calls this.
 */
export function createMockSupabaseUser(overrides?: Partial<User>): User {
  return {
    id: 'test-user-id-' + Math.random().toString(36).substr(2, 9),
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    role: 'authenticated',
    ...overrides,
  } as User;
}

/**
 * Creates a mock Supabase Session object.
 */
export function createMockSession(user?: User): Session {
  const mockUser = user || createMockSupabaseUser();
  return {
    access_token: 'mock-access-token-' + Math.random().toString(36).substr(2, 9),
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: mockUser,
  };
}

/**
 * Configures the mock Supabase client to return a successful auth state.
 *
 * @param user - Optional user to return. If not provided, creates a default user.
 * @returns The user and session that were configured.
 *
 * @example
 * ```typescript
 * const { user, session } = mockSupabaseAuthSuccess();
 * // Now auth.getSession() returns this session
 * // And auth.getUser() returns this user
 * ```
 */
export function mockSupabaseAuthSuccess(user?: User): { user: User; session: Session } {
  const mockClient = getMockSupabaseClient();
  const session = createMockSession(user);

  mockClient.auth.getSession.mockResolvedValue({
    data: { session },
    error: null,
  });

  mockClient.auth.getUser.mockResolvedValue({
    data: { user: session.user },
    error: null,
  });

  return { user: session.user, session };
}

/**
 * Configures the mock Supabase client to return an auth error.
 *
 * @param message - Error message to return.
 * @param code - Optional error code (e.g., 'invalid_credentials').
 *
 * @example
 * ```typescript
 * mockSupabaseAuthError('Invalid login credentials');
 * // Now auth.getSession() returns an error
 * ```
 */
export function mockSupabaseAuthError(message: string, code?: string): void {
  const mockClient = getMockSupabaseClient();
  const error: AuthError = {
    message,
    name: 'AuthError',
    status: 401,
    code: code,
  } as AuthError;

  mockClient.auth.getSession.mockResolvedValue({
    data: { session: null },
    error,
  });

  mockClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error,
  });
}

/**
 * Configures the mock for a successful sign-in operation.
 */
export function mockSupabaseSignInSuccess(user?: User): { user: User; session: Session } {
  const mockClient = getMockSupabaseClient();
  const session = createMockSession(user);

  mockClient.auth.signInWithPassword.mockResolvedValue({
    data: { user: session.user, session },
    error: null,
  });

  mockClient.auth.signInWithOtp.mockResolvedValue({
    data: { user: session.user, session },
    error: null,
  });

  return { user: session.user, session };
}

/**
 * Configures the mock for a failed sign-in operation.
 */
export function mockSupabaseSignInError(message: string): void {
  const mockClient = getMockSupabaseClient();
  const error: AuthError = {
    message,
    name: 'AuthError',
    status: 400,
  } as AuthError;

  mockClient.auth.signInWithPassword.mockResolvedValue({
    data: { user: null, session: null },
    error,
  });
}

// ============================================================
// DATABASE HELPERS
// ============================================================

/**
 * Configures the mock Supabase client to return data from a database query.
 *
 * @param table - The table name being queried.
 * @param data - The data to return.
 * @param options - Additional options for the mock.
 *
 * @example
 * ```typescript
 * const recipes = recipeFactory.createList(5);
 * mockDatabaseQuery('recipes', recipes);
 * // Now supabase.from('recipes').select().then() returns these recipes
 * ```
 */
export function mockDatabaseQuery<T>(
  table: string,
  data: T | T[],
  options?: {
    error?: { message: string; code: string };
    single?: boolean;
  }
): void {
  const mockClient = getMockSupabaseClient();
  const response = {
    data: options?.error ? null : data,
    error: options?.error || null,
  };

  // Create a chainable mock
  const chainableMock = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(options?.single ? response : { ...response, data: Array.isArray(data) ? data[0] : data }),
    maybeSingle: jest.fn().mockResolvedValue(options?.single ? response : { ...response, data: Array.isArray(data) ? data[0] : data }),
    then: jest.fn((resolve) => resolve(response)),
  };

  // Mock the from function to return our chainable mock when the table matches
  mockClient.from.mockImplementation((queriedTable: string) => {
    if (queriedTable === table) {
      return chainableMock;
    }
    // Return default mock for other tables
    return {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      then: jest.fn((resolve) => resolve({ data: [], error: null })),
    };
  });
}

/**
 * Configures the mock for a database error.
 */
export function mockDatabaseError(table: string, message: string, code = 'PGRST116'): void {
  mockDatabaseQuery(table, null, { error: { message, code } });
}

// ============================================================
// STORAGE HELPERS
// ============================================================

/**
 * Configures the mock for a successful file upload.
 */
export function mockStorageUploadSuccess(path: string): void {
  const mockClient = getMockSupabaseClient();

  mockClient.storage.from.mockReturnValue({
    upload: jest.fn().mockResolvedValue({ data: { path }, error: null }),
    download: jest.fn().mockResolvedValue({ data: new Blob(), error: null }),
    remove: jest.fn().mockResolvedValue({ data: [{ name: path }], error: null }),
    getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: `https://storage.test.com/${path}` } }),
    list: jest.fn().mockResolvedValue({ data: [], error: null }),
  });
}

/**
 * Configures the mock for a storage error.
 */
export function mockStorageError(message: string): void {
  const mockClient = getMockSupabaseClient();

  mockClient.storage.from.mockReturnValue({
    upload: jest.fn().mockResolvedValue({ data: null, error: { message } }),
    download: jest.fn().mockResolvedValue({ data: null, error: { message } }),
    remove: jest.fn().mockResolvedValue({ data: null, error: { message } }),
    getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: '' } }),
    list: jest.fn().mockResolvedValue({ data: null, error: { message } }),
  });
}

// ============================================================
// EDGE FUNCTION HELPERS
// ============================================================

/**
 * Configures the mock for an edge function call.
 *
 * @example
 * ```typescript
 * mockEdgeFunctionSuccess('ai-chat', { response: 'Hello!' });
 * // Now supabase.functions.invoke('ai-chat') returns { response: 'Hello!' }
 * ```
 */
export function mockEdgeFunctionSuccess<T>(functionName: string, data: T): void {
  const mockClient = getMockSupabaseClient();

  mockClient.functions.invoke.mockImplementation((name: string) => {
    if (name === functionName) {
      return Promise.resolve({ data, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });
}

/**
 * Configures the mock for an edge function error.
 */
export function mockEdgeFunctionError(functionName: string, message: string): void {
  const mockClient = getMockSupabaseClient();

  mockClient.functions.invoke.mockImplementation((name: string) => {
    if (name === functionName) {
      return Promise.resolve({ data: null, error: { message } });
    }
    return Promise.resolve({ data: null, error: null });
  });
}

// ============================================================
// RESET HELPER
// ============================================================

/**
 * Resets all Supabase mocks to their default state.
 * Call this in beforeEach() or afterEach() to ensure test isolation.
 */
export function resetSupabaseMocks(): void {
  const mockClient = getMockSupabaseClient();

  // Reset auth mocks
  mockClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mockClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mockClient.auth.signInWithPassword.mockResolvedValue({ data: null, error: null });
  mockClient.auth.signInWithOtp.mockResolvedValue({ data: null, error: null });
  mockClient.auth.signOut.mockResolvedValue({ error: null });

  // Reset from mock to default behavior
  mockClient.from.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    then: jest.fn((resolve) => resolve({ data: [], error: null })),
  });

  // Reset storage mock
  mockClient.storage.from.mockReturnValue({
    upload: jest.fn().mockResolvedValue({ data: { path: 'test/path' }, error: null }),
    download: jest.fn().mockResolvedValue({ data: new Blob(), error: null }),
    remove: jest.fn().mockResolvedValue({ data: [], error: null }),
    getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://test.com/image.jpg' } }),
    list: jest.fn().mockResolvedValue({ data: [], error: null }),
  });

  // Reset functions mock
  mockClient.functions.invoke.mockResolvedValue({ data: null, error: null });
}
