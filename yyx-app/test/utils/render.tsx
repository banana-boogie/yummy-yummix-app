/**
 * Custom Test Render Utilities
 *
 * This module provides a custom render function that wraps components
 * with all required providers (Auth, Language, Query, etc.).
 *
 * FOR AI AGENTS:
 * - Always use `renderWithProviders` instead of `render` from @testing-library/react-native
 * - This ensures components have access to all required contexts
 * - You can override provider values for specific test scenarios
 *
 * @example
 * ```typescript
 * import { renderWithProviders, screen, fireEvent } from '@/test/utils/render';
 *
 * it('renders correctly', () => {
 *   renderWithProviders(<MyComponent />);
 *   expect(screen.getByText('Hello')).toBeTruthy();
 * });
 * ```
 */

import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ============================================================
// TEST QUERY CLIENT
// ============================================================

/**
 * Creates a QueryClient configured for testing.
 * - No retries (tests should fail fast)
 * - No caching (tests should be isolated)
 * - Suppressed error logging (cleaner test output)
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// ============================================================
// PROVIDER WRAPPER
// ============================================================

interface AllProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

/**
 * Wraps children with all required providers.
 * Order matters - outer providers should be listed first.
 */
function AllProviders({ children, queryClient }: AllProvidersProps): ReactElement {
  const client = queryClient || createTestQueryClient();

  return (
    <QueryClientProvider client={client}>
      {/*
        Note: Context providers are mocked in jest.setup.js
        If you need to test with real context values, you can import
        and wrap with the actual providers here.

        Example:
        <AuthProvider>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </AuthProvider>
      */}
      {children}
    </QueryClientProvider>
  );
}

// ============================================================
// CUSTOM RENDER FUNCTION
// ============================================================

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Custom QueryClient instance for testing query behavior */
  queryClient?: QueryClient;
}

/**
 * Custom render function that wraps components with all required providers.
 *
 * FOR AI AGENTS:
 * - Use this function for ALL component tests
 * - Pass `queryClient` option if you need to control query state
 * - All standard @testing-library/react-native methods work as expected
 *
 * @example
 * ```typescript
 * // Basic usage
 * renderWithProviders(<MyComponent />);
 *
 * // With custom query client
 * const queryClient = createTestQueryClient();
 * renderWithProviders(<MyComponent />, { queryClient });
 *
 * // With initial route params (for screen tests)
 * renderWithProviders(<ProfileScreen />, {
 *   // Pass any RenderOptions from testing-library
 * });
 * ```
 */
export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
): RenderResult {
  const { queryClient, ...renderOptions } = options;

  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders queryClient={queryClient}>{children}</AllProviders>
    ),
    ...renderOptions,
  });
}

// ============================================================
// RE-EXPORTS
// ============================================================

// Re-export everything from React Testing Library for convenience
export * from '@testing-library/react-native';

// Export the custom render as the default render
export { renderWithProviders as render };
