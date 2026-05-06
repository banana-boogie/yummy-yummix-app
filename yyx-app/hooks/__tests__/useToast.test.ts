import { renderHook } from '@testing-library/react-native';
import { useToast } from '../useToast';

describe('useToast', () => {
  it('returns a stable object when callback dependencies do not change', () => {
    const { result, rerender } = renderHook(() => useToast());
    const firstToast = result.current;

    rerender({});

    expect(result.current).toBe(firstToast);
  });
});
