import { QueryClient } from '@tanstack/react-query';

// Create a client with sensible defaults for React Native
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Data is considered fresh for 5 minutes
            staleTime: 5 * 60 * 1000,

            // Keep unused data in cache for 30 minutes (garbage collection)
            gcTime: 30 * 60 * 1000,

            // Retry failed requests up to 2 times
            retry: 2,

            // Don't refetch on window focus in React Native (app state handled separately)
            refetchOnWindowFocus: false,

            // Refetch when network reconnects
            refetchOnReconnect: true,
        },
        mutations: {
            // Retry mutations once on failure
            retry: 1,
        },
    },
});
