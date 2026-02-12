# Recipe Rating Feature Tests

This directory contains unit tests for the recipe rating and completion tracking feature.

## Running Tests

```bash
# Run all tests (watch mode)
npm test

# Run tests once
npm test -- --watchAll=false

# Run specific test file
npm test ratingService.test.ts

# Run tests with coverage
npm test -- --coverage
```

## Test Files

### Services
- **`services/ratingService.test.ts`** - Tests for rating submission, feedback, and validation
  - Rating submission (1-5 stars, integer validation)
  - Feedback submission (length validation, trimming)
  - User rating retrieval
  - Rating statistics
  - Rating distribution (single query + client-side grouping)

- **`services/completionService.test.ts`** - Tests for recipe completion tracking
  - Recording completions (insert and update paths)
  - Race condition handling (23505 unique violation retry)
  - Unauthenticated user handling
  - Completion existence checks
  - Completion count retrieval

### Components
- **`components/RecipeRatingModal.test.tsx`** - Tests for the rating modal
  - Modal rendering and visibility
  - Skip and submit flows
  - Error states (no rating selected)
  - Feedback input rendering

### Hooks
- **`hooks/useRecipeRating.test.ts`** - Tests for React Query integration
  - User rating fetching
  - Rating distribution fetching
  - Rating submission mutations
  - Feedback submission mutations
  - Error handling

## Coverage Goals

These tests focus on **critical business logic** and **user interactions**:

Covered:
- Rating validation rules
- Recipe existence checks (via shared `validateRecipeIsPublished`)
- User authentication checks
- Input validation (rating range, feedback length)
- Error states and edge cases
- Race condition handling
- React Query caching and invalidation

Not Covered (Intentionally):
- Simple display components (StarRating - pure presentation)
- Layout components
- Translation strings
- Styling/visual regression

## Writing New Tests

When adding new features to the rating system:

1. **Services** - Test business logic and API interactions
   - Mock Supabase calls
   - Test validation rules
   - Test error handling

2. **Components** - Test user interactions and state changes
   - Mock dependencies (haptics, reanimated)
   - Test user events (press, input)
   - Test accessibility

3. **Hooks** - Test React Query integration
   - Wrap in QueryClientProvider
   - Test loading/error states
   - Test optimistic updates

## Common Patterns

### Mocking Supabase
```typescript
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));
```

### Mocking Auth Context
```typescript
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-123' } }),
}));
```

### Testing React Query Hooks
```typescript
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

const { result } = renderHook(() => useMyHook(), { wrapper });
```

## Troubleshooting

### "Cannot find module" errors
- Ensure all dependencies are installed: `npm install`
- Check that `jest.setup.js` is properly configured in `package.json`

### "useNativeDriver" warnings
- Already mocked in `jest.setup.js`

### Async test failures
- Use `waitFor()` from `@testing-library/react-native`
- Ensure proper cleanup in `beforeEach()`
