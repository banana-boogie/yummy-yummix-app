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
  - Recipe validation (published status check)
  - Rating submission (1-5 stars, integer validation)
  - Feedback submission (length validation, trimming)
  - User rating retrieval
  - Rating statistics

### Components
- **`components/StarRatingInput.test.tsx`** - Tests for the interactive star rating component
  - Star rendering (5 stars)
  - Rating display and selection
  - Disabled state
  - Size variations (md, lg)
  - Accessibility labels
  - User interactions

### Hooks
- **`hooks/useRecipeRating.test.ts`** - Tests for React Query integration
  - User rating fetching
  - Rating submission with optimistic updates
  - Feedback submission
  - Error handling
  - Query invalidation

## Coverage Goals

These tests focus on **critical business logic** and **user interactions**:

✅ **Covered:**
- Rating validation rules
- Recipe existence checks
- User authentication checks
- Input validation (rating range, feedback length)
- Error states and edge cases
- Component interactions
- React Query caching and invalidation

❌ **Not Covered (Intentionally):**
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

## Future Test Additions

Consider adding:
- Integration tests for the complete rating flow
- Snapshot tests for UI components
- E2E tests for critical user journeys
- Performance tests for list rendering
