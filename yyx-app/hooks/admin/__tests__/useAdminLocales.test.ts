import { renderHook, waitFor } from '@testing-library/react-native';
import { useAdminLocales } from '../useAdminLocales';

// ---------- Supabase mock ----------

let mockResolvedValue = { data: null as any, error: null as any };

const mockQuery: any = {
  select: jest.fn(),
  not: jest.fn(),
  eq: jest.fn(),
  order: jest.fn(),
  then: (resolve: any) => resolve(mockResolvedValue),
};
mockQuery.select.mockReturnValue(mockQuery);
mockQuery.not.mockReturnValue(mockQuery);
mockQuery.eq.mockReturnValue(mockQuery);
mockQuery.order.mockReturnValue(mockQuery);

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => mockQuery,
  },
}));

// ---------- Tests ----------

describe('useAdminLocales', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filters out es-MX from active locales', async () => {
    mockResolvedValue = {
      data: [
        { code: 'en', display_name: 'English' },
        { code: 'es', display_name: 'Español (México)' },
        { code: 'es-ES', display_name: 'Español (España)' },
        { code: 'es-MX', display_name: 'Español (México)' },
      ],
      error: null,
    };

    const { result } = renderHook(() => useAdminLocales());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const codes = result.current.locales.map(l => l.code);
    expect(codes).toContain('es');
    expect(codes).toContain('en');
    expect(codes).toContain('es-ES');
    expect(codes).not.toContain('es-MX');
  });

  it('passes through loading state from useActiveLocales', () => {
    mockResolvedValue = { data: [], error: null };

    const { result } = renderHook(() => useAdminLocales());

    // Initially loading
    expect(result.current.loading).toBe(true);
  });

  it('works when no es-MX is present', async () => {
    mockResolvedValue = {
      data: [
        { code: 'en', display_name: 'English' },
        { code: 'es', display_name: 'Español' },
      ],
      error: null,
    };

    const { result } = renderHook(() => useAdminLocales());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.locales).toHaveLength(2);
  });
});
