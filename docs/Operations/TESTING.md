# YummyYummix Testing Guide

Comprehensive testing documentation for the YummyYummix monorepo. This guide is designed for both human developers and AI coding agents.

---

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Frontend Testing (yyx-app)](#frontend-testing-yyx-app)
- [Backend Testing (yyx-server)](#backend-testing-yyx-server)
- [CI/CD Pipeline](#cicd-pipeline)
- [Writing Tests](#writing-tests)
- [Mocking Guide](#mocking-guide)
- [Test Factories](#test-factories)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

YummyYummix uses a multi-layered testing strategy:

| Layer | Framework | Location | Run Command |
|-------|-----------|----------|-------------|
| **Frontend Unit/Integration** | Jest + React Testing Library | `yyx-app/` | `npm test` |
| **Backend Unit** | Deno.test | `yyx-server/supabase/functions/` | `deno task test` |
| **Backend Integration** | Bash scripts | `yyx-server/supabase/functions/__tests__/` | `deno task test:integration` |
| **CI/CD** | GitHub Actions | `.github/workflows/` | Automatic on PR/push |

### Test Types

- **Unit Tests**: Test individual functions, components, or modules in isolation
- **Integration Tests**: Test multiple units working together
- **E2E Tests**: (Future) Test complete user flows

### Coverage Goals

| Metric | Target | Current |
|--------|--------|---------|
| Branches | 70% | TBD |
| Functions | 70% | TBD |
| Lines | 70% | TBD |
| Statements | 70% | TBD |

---

## Quick Start

### Frontend (yyx-app)

```bash
cd yyx-app

# Install dependencies (first time)
npm install

# Run tests in watch mode (development)
npm test

# Run tests once with coverage (CI)
npm run test:ci

# Run specific test file
npx jest components/common/__tests__/Button.test.tsx

# Run tests matching pattern
npx jest -t "renders correctly"
```

### Backend (yyx-server)

```bash
cd yyx-server

# Run all unit tests
deno task test

# Run tests in watch mode
deno task test:watch

# Run with coverage
deno task test:coverage
deno task coverage:report

# Run integration tests (requires staging env vars)
export STAGING_SUPABASE_URL="https://your-staging.supabase.co"
export STAGING_SUPABASE_ANON_KEY="your-anon-key"
deno task test:integration
```

---

## Frontend Testing (yyx-app)

### Directory Structure

```
yyx-app/
├── jest.config.js           # Jest configuration
├── jest.setup.js            # Global mocks and setup
├── test/
│   ├── utils/
│   │   └── render.tsx       # Custom render with providers
│   ├── mocks/
│   │   └── supabase.ts      # Supabase mock helpers
│   └── factories/
│       ├── index.ts         # Factory exports
│       ├── recipe.factory.ts
│       └── user.factory.ts
├── components/
│   └── __tests__/           # Component tests
├── services/
│   └── __tests__/           # Service tests
├── hooks/
│   └── __tests__/           # Hook tests
└── contexts/
    └── __tests__/           # Context tests
```

### Test File Naming

- Test files: `*.test.ts` or `*.test.tsx`
- Location: `__tests__/` folder next to source, or `.test.ts` suffix

### Writing Component Tests

**Always use `renderWithProviders`** instead of `render`:

```typescript
import { renderWithProviders, screen, fireEvent } from '@/test/utils/render';
import { Button } from '@/components/common/Button';

describe('Button', () => {
  it('renders with label', () => {
    renderWithProviders(<Button label="Click me" onPress={jest.fn()} />);
    expect(screen.getByText('Click me')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    renderWithProviders(<Button label="Click" onPress={onPress} />);

    fireEvent.press(screen.getByText('Click'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows loading state', () => {
    renderWithProviders(<Button label="Submit" onPress={jest.fn()} loading />);
    expect(screen.getByTestId('loading-indicator')).toBeTruthy();
  });
});
```

### Writing Service Tests

```typescript
import { recipeService } from '@/services/recipeService';
import { mockDatabaseQuery } from '@/test/mocks/supabase';
import { recipeFactory } from '@/test/factories';

describe('recipeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRecipes', () => {
    it('returns recipes from database', async () => {
      const mockRecipes = recipeFactory.createList(5);
      mockDatabaseQuery('recipes', mockRecipes);

      const result = await recipeService.getRecipes({ limit: 5 });

      expect(result.data).toHaveLength(5);
    });

    it('handles database errors', async () => {
      mockDatabaseError('recipes', 'Connection failed');

      const result = await recipeService.getRecipes({ limit: 5 });

      expect(result.error).toBeTruthy();
    });
  });
});
```

### Writing Hook Tests

```typescript
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useRecipeSearch } from '@/hooks/useRecipeSearch';

describe('useRecipeSearch', () => {
  it('returns empty results initially', () => {
    const { result } = renderHook(() => useRecipeSearch());

    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('searches when query changes', async () => {
    const { result } = renderHook(() => useRecipeSearch());

    act(() => {
      result.current.setQuery('pasta');
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});
```

---

## Backend Testing (yyx-server)

### Directory Structure

```
yyx-server/
├── supabase/functions/
│   ├── deno.json            # Deno config with test tasks
│   ├── _shared/
│   │   ├── __tests__/       # Shared utility tests
│   │   │   └── recipe-validator.test.ts
│   │   └── test-helpers/
│   │       └── mocks.ts     # Deno test helpers
│   ├── irmixy-chat-orchestrator/
│   │   ├── index.ts
│   │   ├── types.ts, logger.ts, session.ts, ...  # Extracted modules
│   │   └── *.test.ts        # Function unit tests
│   └── __tests__/           # Integration tests
│       ├── run-integration-tests.sh
│       ├── helpers.sh
│       └── test-*.sh        # Individual integration tests
```

### Writing Deno Unit Tests

```typescript
import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createMockRequest, mockEnv, cleanupEnv } from '../_shared/test-helpers/mocks.ts';

Deno.test('validates recipe data correctly', () => {
  const validRecipe = {
    name: 'Test Recipe',
    difficulty: 'easy',
    ingredients: [{ quantity: 1, ingredient: { name_en: 'Salt' } }],
    steps: [{ order: 1, instruction_en: 'Add salt' }],
  };

  const result = validateRecipeData(validRecipe);

  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test('handles missing fields', () => {
  const invalidRecipe = { name: 'Test' };

  const result = validateRecipeData(invalidRecipe);

  assertEquals(result.valid, false);
  assertExists(result.errors.find(e => e.includes('difficulty')));
});
```

### Writing Integration Tests (Bash)

```bash
#!/bin/bash
# test-irmixy-chat-orchestrator.sh

set -e
source "$(dirname "$0")/helpers.sh"

print_section "Irmixy Chat Orchestrator Integration Tests"

# Test 1: Basic chat message
test_case "sends basic message" \
  "irmixy-chat-orchestrator" \
  '{"message": "Hello", "conversationHistory": []}' \
  "200" \
  "response"

# Test 2: Missing required field
test_case "rejects missing message" \
  "irmixy-chat-orchestrator" \
  '{"conversationHistory": []}' \
  "400" \
  "error"

echo "All irmixy-chat-orchestrator tests passed!"
```

---

## CI/CD Pipeline

### Workflows

| Workflow | Trigger | Jobs |
|----------|---------|------|
| `yyx-app-ci.yml` | Push/PR to main when yyx-app changes | Lint, TypeCheck, Test |
| `yyx-server-ci.yml` | Push/PR to main when yyx-server changes | Lint, Format, Test, Integration |
| `pr-checks.yml` | All PRs | Size check, Label check |

### Required Secrets

Add these to GitHub repository settings:

| Secret | Description |
|--------|-------------|
| `CODECOV_TOKEN` | Coverage reporting token |
| `STAGING_SUPABASE_URL` | Staging Supabase URL for integration tests |
| `STAGING_SUPABASE_ANON_KEY` | Staging Supabase anon key |

### Branch Protection

Recommended settings for `main` branch:
- Require status checks to pass
- Require `yyx-app-ci / test (20)` to pass
- Require `yyx-server-ci / unit-tests` to pass

---

## Writing Tests

### Test Structure (AAA Pattern)

```typescript
it('does something when condition', () => {
  // Arrange - Set up test data and mocks
  const mockData = recipeFactory.create();
  mockDatabaseQuery('recipes', mockData);

  // Act - Perform the action being tested
  const result = await recipeService.getRecipeById(mockData.id);

  // Assert - Verify the expected outcome
  expect(result.data).toEqual(mockData);
});
```

### Naming Conventions

**Test files:**
```
ComponentName.test.tsx    # Component tests
serviceName.test.ts       # Service tests
useSomething.test.ts      # Hook tests
utility.test.ts           # Utility tests
```

**Test descriptions:**
```typescript
describe('ComponentName', () => {
  it('renders with default props', () => {});
  it('calls onPress when button is pressed', () => {});
  it('shows error message when validation fails', () => {});
  it('disables submit button while loading', () => {});
});
```

### What to Test

**DO test:**
- User-visible behavior
- Component rendering
- Event handling
- Error states
- Loading states
- Edge cases
- Business logic

**DON'T test:**
- Implementation details
- Third-party library code
- Styling (unless behavior-dependent)
- Private functions directly

---

## Mocking Guide

### Supabase Authentication

```typescript
import {
  mockSupabaseAuthSuccess,
  mockSupabaseAuthError,
  mockSupabaseSignInSuccess
} from '@/test/mocks/supabase';
import { userFactory } from '@/test/factories';

// Mock successful auth state
const user = userFactory.createSupabaseUser();
mockSupabaseAuthSuccess(user);

// Mock auth error
mockSupabaseAuthError('Invalid credentials');

// Mock successful sign in
mockSupabaseSignInSuccess(user);
```

### Database Queries

```typescript
import { mockDatabaseQuery, mockDatabaseError } from '@/test/mocks/supabase';
import { recipeFactory } from '@/test/factories';

// Mock successful query
const recipes = recipeFactory.createList(5);
mockDatabaseQuery('recipes', recipes);

// Mock query error
mockDatabaseError('recipes', 'Connection failed');
```

### Edge Functions

```typescript
import { mockEdgeFunctionSuccess, mockEdgeFunctionError } from '@/test/mocks/supabase';

// Mock successful function call
mockEdgeFunctionSuccess('irmixy-chat-orchestrator', { response: 'Hello!' });

// Mock function error
mockEdgeFunctionError('irmixy-chat-orchestrator', 'Rate limit exceeded');
```

### Storage

```typescript
import { mockStorageUploadSuccess, mockStorageError } from '@/test/mocks/supabase';

// Mock successful upload
mockStorageUploadSuccess('images/recipe-123.jpg');

// Mock storage error
mockStorageError('Upload failed');
```

---

## Test Factories

Factories generate realistic test data with sensible defaults.

### Recipe Factory

```typescript
import { recipeFactory } from '@/test/factories';

// Create single recipe
const recipe = recipeFactory.create();

// Create with overrides
const easyRecipe = recipeFactory.create({
  difficulty: RecipeDifficulty.EASY,
  name: 'Simple Pasta',
});

// Create multiple
const recipes = recipeFactory.createList(10);

// Create related entities
const ingredient = recipeFactory.createIngredient();
const step = recipeFactory.createStep();
const tag = recipeFactory.createTag();
```

### User Factory

```typescript
import { userFactory } from '@/test/factories';

// Create Supabase User (for auth tests)
const user = userFactory.createSupabaseUser();
const admin = userFactory.createAdminSupabaseUser();

// Create UserProfile (for profile tests)
const profile = userFactory.createProfile();
const adminProfile = userFactory.createAdminProfile();
const newUser = userFactory.createNewUserProfile(); // Onboarding not complete
```

---

## Best Practices

### General

1. **One assertion concept per test** - Test one thing at a time
2. **Descriptive test names** - Should read like documentation
3. **Isolated tests** - Each test should be independent
4. **Fast tests** - Mock slow operations (network, DB)
5. **Deterministic** - Same input = same output, always

### For AI Agents

1. **Always use factories** - Don't manually create test data
2. **Use `renderWithProviders`** - Ensures all contexts are available
3. **Clear mocks in `beforeEach`** - Prevents test pollution
4. **Follow existing patterns** - Check similar test files for examples
5. **Test behavior, not implementation** - Focus on what the user sees

### Code Example

```typescript
// ✅ GOOD - Behavior-focused
it('shows error message when email is invalid', () => {
  renderWithProviders(<LoginForm />);

  fireEvent.changeText(screen.getByLabelText('Email'), 'invalid');
  fireEvent.press(screen.getByText('Submit'));

  expect(screen.getByText('Please enter a valid email')).toBeTruthy();
});

// ❌ BAD - Implementation-focused
it('calls setError with email error', () => {
  const setError = jest.fn();
  // Testing internal implementation...
});
```

---

## Troubleshooting

### Common Issues

**Tests timeout**
```typescript
// Increase timeout for specific test
it('slow operation', async () => {
  // test code
}, 15000); // 15 second timeout
```

**Mock not working**
```typescript
// Ensure mock is BEFORE imports
jest.mock('@/lib/supabase');
import { supabase } from '@/lib/supabase'; // After mock
```

**Act warning**
```typescript
// Wrap state updates in act()
import { act } from '@testing-library/react-native';

await act(async () => {
  fireEvent.press(button);
});
```

**Coverage below threshold**
```bash
# See detailed coverage report
npm run test:coverage
open coverage/lcov-report/index.html
```

### Deno Issues

**Module not found**
```bash
# Clear Deno cache
deno cache --reload supabase/functions/
```

**Permission denied**
```bash
# Add required permissions
deno test --allow-env --allow-net --allow-read
```

### Getting Help

1. Check existing test files for patterns
2. Review this documentation
3. Check Jest/Deno official docs
4. Ask in team Slack #engineering

---

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Expo Testing Guide](https://docs.expo.dev/develop/unit-testing/)
- [Deno Testing](https://docs.deno.com/runtime/manual/basics/testing/)
- [GitHub Actions](https://docs.github.com/en/actions)

---

**Last Updated:** 2026-01-27
