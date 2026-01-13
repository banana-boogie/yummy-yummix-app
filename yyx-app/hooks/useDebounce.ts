import { useState, useEffect } from 'react';

/**
 * A hook that delays updating a value until after a specified delay
 * 
 * Most UI interactions typically use:
 * 300ms for common searches
 * 200ms for autocomplete features
 * 100ms for immediate feedback (like filtering a list)
 * 
 * 50ms for real-time updates (like a chat)
 * 
 * 10ms for instant updates (like a button click)
 * 
 * @param value The value to debounce
 * @param delay The delay in milliseconds (default: 300ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up a timer that will update the debounced value after the delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clear the timer if the value changes before the delay has passed
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
} 