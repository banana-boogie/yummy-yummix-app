# AGENT.md

Guidelines for AI coding agents working on the YummyYummix codebase. This file supplements [CLAUDE.md](./CLAUDE.md) with AI-specific instructions.

---

## Core Principles

1. **Read before writing** - Always read existing files before modifying them
2. **Follow existing patterns** - Match the style and structure of similar files
3. **Test your work** - Write tests for critical code you create or modify
4. **Keep changes focused** - Don't refactor unrelated code or add unnecessary features

---

## Testing Requirements

> The testing requirements table below is also defined in the canonical [`docs/agent-guidelines/REVIEW-CRITERIA.md`](./docs/agent-guidelines/REVIEW-CRITERIA.md). Keep both in sync.

**You MUST write tests for:**

| What You Create/Modify | Required Tests |
|------------------------|----------------|
| New component | Unit test covering rendering, interactions, states |
| New service function | Unit test with mocked dependencies |
| New Edge Function | Deno unit test + update integration tests |
| Bug fix | Regression test that would have caught the bug |
| Auth/security code | Comprehensive tests for success AND failure paths |

### Before Writing Tests

1. Read [TESTING.md](./docs/operations/TESTING.md) for patterns and conventions
2. Look at existing test files for similar code:
   - `yyx-app/components/common/__tests__/Button.test.tsx` - Component test example
   - `yyx-server/supabase/functions/_shared/__tests__/` - Deno test examples
3. Use test factories - never manually construct test data

### Test File Structure

```typescript
/**
 * ComponentName Tests
 *
 * Brief description of what's being tested.
 *
 * FOR AI AGENTS:
 * - Note any special setup required
 * - List mocks that need configuration
 * - Reference related test files
 */

import { renderWithProviders, screen, fireEvent } from '@/test/utils/render';
import { componentFactory } from '@/test/factories';

// Mock dependencies BEFORE imports that use them
jest.mock('@/hooks/useDevice', () => ({
  useDevice: () => ({ isPhone: true, isTablet: false }),
}));

describe('ComponentName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Group tests by category
  describe('rendering', () => {
    it('renders with default props', () => { /* ... */ });
  });

  describe('interactions', () => {
    it('calls onPress when pressed', () => { /* ... */ });
  });

  describe('error states', () => {
    it('shows error message when validation fails', () => { /* ... */ });
  });
});
```

### Running Tests

```bash
# Always run tests after making changes
cd yyx-app && npm test -- --watchAll=false  # Frontend
cd yyx-server && deno task test              # Backend

# Run specific test file
npx jest components/common/__tests__/Button.test.tsx
```

---

## Code Quality Checklist

Before considering your work complete, verify:

- [ ] Code follows existing patterns in the codebase
- [ ] TypeScript has no errors (`npm run typecheck`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Tests pass (`npm test`)
- [ ] **New tests written** for critical functionality
- [ ] No hardcoded strings (use i18n)
- [ ] No console.log statements left in code
- [ ] Imports use `@/` alias

---

## Critical vs Non-Critical Code

### Always Test (Critical)

- **Authentication**: Login, logout, session management, protected routes
- **Data mutations**: Create, update, delete operations
- **Payment/billing**: Any code touching money (future)
- **User input validation**: Forms, search, filters
- **Core components**: Button, Text, Input, Modal, Form components
- **Business logic**: Recipe calculations, unit conversions, scoring
- **Edge Functions**: All serverless functions

### Optional Tests (Non-Critical)

- Pure presentational components with no logic
- Static pages (About, Terms, etc.)
- Simple wrappers around library components
- Development-only utilities

---

## Common Patterns

### Mocking Supabase

```typescript
import { mockDatabaseQuery, mockSupabaseAuthSuccess } from '@/test/mocks/supabase';
import { userFactory, recipeFactory } from '@/test/factories';

// Mock authenticated user
mockSupabaseAuthSuccess(userFactory.createSupabaseUser());

// Mock database query
mockDatabaseQuery('recipes', recipeFactory.createList(5));
```

### Testing Async Operations

```typescript
import { waitFor } from '@testing-library/react-native';

it('loads data on mount', async () => {
  renderWithProviders(<RecipeList />);

  await waitFor(() => {
    expect(screen.getByText('Recipe 1')).toBeTruthy();
  });
});
```

### Testing Error States

```typescript
import { mockDatabaseError } from '@/test/mocks/supabase';

it('shows error when fetch fails', async () => {
  mockDatabaseError('recipes', 'Network error');

  renderWithProviders(<RecipeList />);

  await waitFor(() => {
    expect(screen.getByText(/error/i)).toBeTruthy();
  });
});
```

---

## File Locations

| What | Where |
|------|-------|
| Test utilities | `yyx-app/test/utils/` |
| Mock helpers | `yyx-app/test/mocks/` |
| Test factories | `yyx-app/test/factories/` |
| Component tests | `yyx-app/components/**/__tests__/` |
| Service tests | `yyx-app/services/__tests__/` |
| Hook tests | `yyx-app/hooks/__tests__/` |
| Deno test helpers | `yyx-server/supabase/functions/_shared/test-helpers/` |
| Deno unit tests | Next to source file as `*.test.ts` |
| Integration tests | `yyx-server/supabase/functions/__tests__/` |

---

## Troubleshooting

### "Cannot find module" in tests

Ensure Jest moduleNameMapper in `jest.config.js` matches tsconfig paths.

### Mock not working

Mocks must be defined BEFORE importing the module that uses them:
```typescript
// CORRECT
jest.mock('@/lib/supabase');
import { supabase } from '@/lib/supabase';

// WRONG - import before mock
import { supabase } from '@/lib/supabase';
jest.mock('@/lib/supabase');
```

### Test passes locally but fails in CI

- Check for time-dependent tests (use fake timers)
- Check for random data (use seeded factories)
- Check for environment-specific code

---

## Resources

- [TESTING.md](./docs/operations/TESTING.md) - Full testing documentation
- [CLAUDE.md](./CLAUDE.md) - General development guidelines
- Example tests:
  - `yyx-app/components/common/__tests__/Button.test.tsx`
  - `yyx-server/supabase/functions/_shared/__tests__/recipe-validator.test.ts`
