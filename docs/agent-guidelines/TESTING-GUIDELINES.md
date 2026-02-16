# Testing Guidelines

Domain playbook for testing YummyYummix — Jest (frontend) and Deno.test (backend).

**Primary reference:** `docs/operations/TESTING.md` — comprehensive 600+ line testing guide. Read this for deep context.

---

## Quick Decision Tree: Should I Write a Test?

```
Is this new code?
├── Yes → Is it critical? (auth, data mutations, business logic, edge functions)
│   ├── Yes → MUST test (High/Critical if missing)
│   └── No → Is it a component with logic/interactions?
│       ├── Yes → Should test
│       └── No → Optional (pure presentational, static pages)
└── No → Is this a bug fix?
    ├── Yes → Write regression test
    └── No → Is this a refactor?
        └── Ensure existing tests still pass
```

---

## Frontend Testing (Jest + React Testing Library)

### Infrastructure

| File | Purpose |
|------|---------|
| `yyx-app/jest.config.js` | Jest configuration |
| `yyx-app/jest.setup.js` | Global mocks and setup |
| `yyx-app/test/utils/render.tsx` | `renderWithProviders` — **always use this, never plain `render`** |
| `yyx-app/test/factories/recipe.factory.ts` | `recipeFactory.create()`, `.createList(n)`, `.createIngredient()`, `.createStep()`, `.createTag()` |
| `yyx-app/test/factories/user.factory.ts` | `userFactory.createSupabaseUser()`, `.createProfile()`, `.createAdminProfile()`, `.createNewUserProfile()` |
| `yyx-app/test/mocks/supabase.ts` | `mockDatabaseQuery()`, `mockDatabaseError()`, `mockSupabaseAuthSuccess()`, `mockEdgeFunctionSuccess()`, `mockStorageUploadSuccess()` |

### Test File Location & Naming
- Location: `__tests__/` folder next to source code
- Naming: `ComponentName.test.tsx`, `serviceName.test.ts`, `useSomething.test.ts`

### Component Test Template

```typescript
import { renderWithProviders, screen, fireEvent } from '@/test/utils/render';
import { MyComponent } from '@/components/feature/MyComponent';

describe('MyComponent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    renderWithProviders(<MyComponent title="Hello" />);
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('handles user interaction', () => {
    const onPress = jest.fn();
    renderWithProviders(<MyComponent onPress={onPress} />);

    fireEvent.press(screen.getByText('Action'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows loading state', () => {
    renderWithProviders(<MyComponent loading />);
    expect(screen.getByTestId('loading-indicator')).toBeTruthy();
  });

  it('handles error state', () => {
    renderWithProviders(<MyComponent error="Something failed" />);
    expect(screen.getByText('Something failed')).toBeTruthy();
  });
});
```

### Service Test Template

```typescript
import { myService } from '@/services/myService';
import { mockDatabaseQuery, mockDatabaseError } from '@/test/mocks/supabase';
import { recipeFactory } from '@/test/factories';

describe('myService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches data successfully', async () => {
    const mockData = recipeFactory.createList(5);
    mockDatabaseQuery('recipes', mockData);

    const result = await myService.getData({ limit: 5 });

    expect(result.data).toHaveLength(5);
  });

  it('handles database errors', async () => {
    mockDatabaseError('recipes', 'Connection failed');

    const result = await myService.getData({ limit: 5 });

    expect(result.error).toBeTruthy();
  });
});
```

### Hook Test Template

```typescript
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useMyHook } from '@/hooks/useMyHook';

describe('useMyHook', () => {
  it('returns initial state', () => {
    const { result } = renderHook(() => useMyHook());
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('updates state on action', async () => {
    const { result } = renderHook(() => useMyHook());

    act(() => {
      result.current.doAction();
    });

    await waitFor(() => {
      expect(result.current.data).toBeTruthy();
    });
  });
});
```

### Run Commands

```bash
npm test                    # Watch mode
npm run test:ci             # CI mode with coverage
npx jest path/to/test       # Specific file
npx jest -t "test name"     # Pattern match
```

---

## Backend Testing (Deno.test)

### Infrastructure

| File | Purpose |
|------|---------|
| `_shared/test-helpers/mocks.ts` | `createMockRequest()`, `createAuthenticatedRequest()`, `mockEnv()`, `cleanupEnv()`, `createMockSupabaseClient()`, `createMockFetch()` |

### Test File Location & Naming
- Location: `*.test.ts` next to source, or `__tests__/` directory
- Naming: `module-name.test.ts`

### Unit Test Template

```typescript
import { assertEquals, assertRejects, assertThrows } from "https://deno.land/std/assert/mod.ts";
import { myFunction } from './my-module.ts';

Deno.test('myFunction - returns expected result', () => {
  const result = myFunction({ input: 'test' });
  assertEquals(result.status, 'success');
});

Deno.test('myFunction - validates input', () => {
  assertThrows(
    () => myFunction({ input: '' }),
    Error,
    'Input required'
  );
});

Deno.test('myFunction - handles async errors', async () => {
  await assertRejects(
    () => myFunction({ input: 'invalid' }),
    Error,
    'Not found'
  );
});
```

### Edge Function Test Template

```typescript
import { assertEquals } from "https://deno.land/std/assert/mod.ts";
import { createMockRequest, mockEnv, cleanupEnv } from '../_shared/test-helpers/mocks.ts';

Deno.test('edge function - rejects unauthenticated requests', async () => {
  const req = createMockRequest({ method: 'POST', body: {} });
  const response = await handler(req);
  assertEquals(response.status, 401);
});

Deno.test('edge function - processes valid request', async () => {
  mockEnv({ OPENAI_API_KEY: 'test-key' });
  try {
    const req = createAuthenticatedRequest({
      method: 'POST',
      body: { message: 'hello' }
    });
    const response = await handler(req);
    assertEquals(response.status, 200);
  } finally {
    cleanupEnv();
  }
});
```

### Run Commands

```bash
deno task test              # Unit tests
deno task test:watch        # Watch mode
deno task test:coverage     # With coverage
deno task test:integration  # Integration tests (requires staging env)
```

---

## What MUST Be Tested (Critical)

| What | Required Tests | Severity if Missing |
|------|---------------|-------------------|
| Authentication flows | Success AND failure paths | Critical |
| Data mutations (CRUD) | Happy path + error handling | High |
| User input validation | Valid, invalid, edge cases | High |
| Core components (Button, Text, Input) | Rendering, interactions, states | High |
| Business logic (calculations, scoring) | Expected outputs, edge cases | High |
| Edge Functions | Auth, input validation, response format | High |
| Bug fixes | Regression test that catches the bug | High |

## What Is Optional

- Pure presentational components with no logic
- Static pages
- Simple wrappers around library components

---

## Best Practices

1. **AAA pattern** — Arrange, Act, Assert. Clear separation in every test.
2. **Test behavior, not implementation** — Test what the user sees, not internal state.
3. **Always use factories** — Never hardcode test data inline.
4. **Clear mocks in `beforeEach`** — Prevent test pollution.
5. **One assertion concept per test** — A test should verify one thing.
6. **Descriptive names** — Test names should read like documentation: `it('shows error when email is invalid')`.
7. **Don't test library code** — Trust React, Supabase, etc. Test YOUR logic.

---

## Reference Tests

Use these as examples of good test patterns:

**Frontend:**
- `yyx-app/components/common/__tests__/Button.test.tsx`
- `yyx-app/services/__tests__/chatService.test.ts`
- `yyx-app/services/voice/providers/__tests__/OpenAIRealtimeProvider.test.ts`

**Backend:**
- `yyx-server/supabase/functions/_shared/tools/tool-registry.test.ts`
- `yyx-server/supabase/functions/_shared/__tests__/food-safety.test.ts`
- `yyx-server/supabase/functions/_shared/rag/hybrid-search.test.ts`
