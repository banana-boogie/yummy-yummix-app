## Testing

**Always write tests for critical components and workflows.** See [TESTING.md](./docs/operations/TESTING.md) for comprehensive documentation.

### Quick Reference

```bash
# Frontend (yyx-app/)
npm test                    # Watch mode
npm run test:ci             # CI mode with coverage

# Backend (yyx-server/)
deno task test              # Run unit tests
deno task test:integration  # Integration tests
```

### What Must Be Tested

| What You Create/Modify | Required Tests |
|------------------------|----------------|
| New component | Unit test covering rendering, interactions, states |
| New service function | Unit test with mocked dependencies |
| New Edge Function | Deno unit test + update integration tests |
| Bug fix | Regression test that would have caught the bug |
| Auth/security code | Comprehensive tests for success AND failure paths |

### Critical vs Non-Critical Code

**Always test (critical):**
- Authentication (login, logout, session management, protected routes)
- Data mutations (create, update, delete)
- User input validation (forms, search, filters)
- Core components (Button, Text, Input, Modal, Form)
- Business logic (calculations, conversions, scoring)
- Edge Functions (all serverless functions)

**Optional tests (non-critical):**
- Pure presentational components with no logic
- Static pages
- Simple wrappers around library components

### Test Patterns

**Component tests** - Use `renderWithProviders` and test user-visible behavior:
```typescript
import { renderWithProviders, screen, fireEvent } from '@/test/utils/render';

it('submits form when valid', () => {
  renderWithProviders(<LoginForm />);
  fireEvent.changeText(screen.getByLabelText('Email'), 'test@example.com');
  fireEvent.press(screen.getByText('Submit'));
  expect(mockLogin).toHaveBeenCalled();
});
```

**Service tests** - Use factories and mock Supabase:
```typescript
import { recipeFactory } from '@/test/factories';
import { mockDatabaseQuery } from '@/test/mocks/supabase';

it('fetches recipes', async () => {
  mockDatabaseQuery('recipes', recipeFactory.createList(5));
  const result = await recipeService.getRecipes();
  expect(result.data).toHaveLength(5);
});
```

**Edge function tests** - Use Deno.test with assertions:
```typescript
Deno.test('validates input', () => {
  const result = validateRecipeData({ name: '' });
  assertEquals(result.valid, false);
});
```

### Pre-commit Hooks

Tests don't run on pre-commit (too slow), but linting does:
- **yyx-app**: ESLint runs via lint-staged
- **yyx-server**: Deno fmt + lint runs on staged files

CI runs full test suites on every PR.
