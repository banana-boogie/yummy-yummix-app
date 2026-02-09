# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**YummyYummix** is a cross-platform cooking app with recipe discovery, step-by-step cooking guides, and AI-powered sous chef features.

### Repository Structure
- `yyx-app/` - React Native mobile app (Expo)
- `yyx-server/` - Backend with Supabase Edge Functions (Deno/TypeScript)
- `supabase/` - Supabase configuration

## Development Setup

### Prerequisites
- **Node.js** (v18+)
- **Docker Desktop** (for local Supabase)
- **Supabase CLI**: `brew install supabase/tap/supabase`
- **iOS**: Xcode (for iOS development)
- **Android**: Android Studio (for Android development)

### First-Time Setup

1. **Install dependencies**
   ```bash
   cd yyx-app
   npm install
   ```

2. **Start local Supabase**
   ```bash
   cd yyx-server
   supabase start
   ```

   This will:
   - Start PostgreSQL, PostgREST, GoTrue, Storage, and other services
   - Apply all migrations from `supabase/migrations/`
   - Give you local URLs and credentials

3. **Environment Configuration**

   The app uses two environment files:
   - **`.env.local`** (committed) - Local development, points to `http://192.168.1.x:54321`
   - **`.env`** (gitignored) - Production secrets, points to cloud Supabase

   By default, `.env.local` takes priority, so you'll use local Supabase automatically.

   **Note**: If your local network IP changes, update `EXPO_PUBLIC_SUPABASE_URL` in `.env.local`
   ```bash
   # Find your IP
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

4. **Build and run**
   ```bash
   cd yyx-app
   npm run ios:device    # For physical iPhone
   npm run ios           # For iOS Simulator
   npm run android       # For Android
   ```

---

## Daily Development Workflow

### 1. Start Local Supabase
```bash
cd yyx-server
supabase start        # Start all services
supabase status       # Check if running
supabase stop         # Stop when done
```

### 2. Run the App
```bash
cd yyx-app
npm run ios:device    # Local dev on physical device
npm run ios:local     # Same as above
npm run ios:prod      # Production build (uses cloud Supabase)
```

### 3. Making Database Changes

**Create a new migration:**
```bash
cd yyx-server
supabase migration new add_my_feature
```

**Edit the migration:**
- File will be in: `yyx-server/supabase/migrations/TIMESTAMP_add_my_feature.sql`
- Write your SQL (CREATE TABLE, ALTER TABLE, etc.)

**Test locally:**
```bash
supabase db reset     # Drops DB, reapplies all migrations
```

**Push to production:**
```bash
supabase db push      # Applies new migrations to cloud
```

**Why `db reset` vs `migration up`?**
- `db reset` validates your entire migration chain works from scratch
- Catches ordering issues before production
- Recommended for local development
- Production uses `db push` which only applies new migrations

### 4. Working with Edge Functions
```bash
cd yyx-server

# Test locally
supabase functions serve [function-name] --env-file .env

# Deploy to production
supabase functions deploy [function-name]
```

---

## Development Commands Reference

### Mobile App (yyx-app/)
```bash
npm install          # Install dependencies
npm start            # Start Expo dev server
npm run ios          # Run on iOS Simulator
npm run ios:device   # Run on physical iPhone (local dev)
npm run ios:local    # Same as above
npm run ios:prod     # Build with production Supabase
npm run android      # Run on Android
npm run web          # Run web version
npm test             # Run tests with Jest (watch mode)
npm run lint         # Run ESLint
```

### Supabase (yyx-server/)
```bash
supabase start                    # Start all local services
supabase stop                     # Stop all services
supabase status                   # Check service status
supabase migration new <name>    # Create new migration
supabase db reset                # Reset and reapply all migrations
supabase db push                 # Push migrations to production
supabase functions serve         # Run edge functions locally
supabase functions deploy <name> # Deploy edge function
```

### Running Tests

**Frontend (yyx-app/)**
```bash
npm test                          # Run all tests (watch mode)
npm run test:ci                   # Run tests once with coverage (CI mode)
npm run test:coverage             # Generate coverage report
npx jest path/to/test             # Run specific test file
npx jest -t "test name"           # Run tests matching pattern
```

**Backend (yyx-server/)**
```bash
deno task test                    # Run all Deno unit tests
deno task test:watch              # Run tests in watch mode
deno task test:coverage           # Run with coverage
deno task test:integration        # Run integration tests (requires staging env)
```

For detailed testing documentation, see [TESTING.md](./TESTING.md).

---

## Environment Variables

### Local Development (`.env.local` - committed)
```bash
EXPO_PUBLIC_SUPABASE_URL=http://192.168.1.222:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc... # Local dev key (safe to commit)
EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL=http://192.168.1.222:54321/functions/v1
```

### Production (`.env` - gitignored, contains secrets)
```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc... # Production key (secret)
EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL=https://xxx.supabase.co/functions/v1
OPENAI_API_KEY=sk-proj-xxx          # Secret
USDA_API_KEY=xxx                     # Secret
```

**Priority**: `.env.local` overrides `.env` when present.

---

## Troubleshooting

### App can't connect to local Supabase
1. Check Supabase is running: `cd yyx-server && supabase status`
2. Verify your IP hasn't changed: `ifconfig | grep "inet " | grep -v 127.0.0.1`
3. Update `.env.local` if IP changed
4. Ensure Mac and device are on same WiFi network
5. Check firewall isn't blocking port 54321

### Native build folders (`ios/`, `android/`) appear
- These are auto-generated and gitignored
- Safe to delete - they'll regenerate on next `expo run:ios`
- Only needed if you have custom native code

### Migrations out of sync
```bash
# Pull current production schema
cd yyx-server
supabase db pull

# Reset local DB to match
supabase db reset
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React Native + Expo |
| Styling | NativeWind (Tailwind for RN) |
| Backend | Supabase (Auth, DB, Storage, Edge Functions) |
| Routing | Expo Router (file-based in `app/`) |
| Edge Functions | Deno + TypeScript |

## Architecture

### Mobile App (`yyx-app/`)
- **`app/`** - Expo Router screens (file-based routing). DO NOT put components or types here.
- **`components/`** - Reusable UI components. Use subdirectories with `index.ts` exports.
- **`components/common/`** - Core shared components (Text, Button, etc.)
- **`components/layouts/`** - PageLayout, ResponsiveLayout
- **`contexts/`** - React contexts (Auth, Language, Measurement, UserProfile, Onboarding)
- **`services/`** - API/data services for Supabase interactions
- **`hooks/`** - Custom React hooks
- **`types/`** - TypeScript definitions (recipe.types.ts, recipe.api.types.ts, user.ts)
- **`constants/design-tokens.js`** - All colors, spacing, typography, border radius
- **`i18n/index.ts`** - Translations for `en` and `es`

### Edge Functions (`yyx-server/supabase/functions/`)
- **`_shared/`** - Shared utilities (CORS, auth, AI gateway)
- **`ai-chat/`**, **`ai-voice/`** - AI sous chef endpoints
- **`get-nutritional-facts/`**, **`parse-recipe-markdown/`** - Recipe utilities

## Key Conventions

### Imports
Always use `@/` alias: `import { Button } from '@/components/common'`

### Text Component
Never use React Native's Text. Always use the app's Text component:
```tsx
import { Text } from '@/components/common';
<Text preset="h1">Heading</Text>
<Text preset="body">Content</Text>
```
Presets: `h1`, `h2`, `h3`, `subheading`, `body`, `bodySmall`, `caption`, `link`, `handwritten`

### Button Component
```tsx
import { Button } from '@/components/common';
<Button variant="primary" onPress={handlePress}>Save</Button>
<Button variant="secondary" size="small">Cancel</Button>
<Button variant="outline" icon={myIcon}>With Icon</Button>
```

### Internationalization
Two languages: English (`en`) and Mexican Spanish (`es`).
```tsx
import i18n from '@/i18n';
<Text>{i18n.t('recipes.common.search')}</Text>

// Access current language
import { useLanguage } from '@/contexts/LanguageContext';
const { language } = useLanguage();
```
- Never hardcode user-facing strings
- Add translations to BOTH languages in `i18n/index.ts`

### Styling with NativeWind
Use design tokens from `constants/design-tokens.js`:
```tsx
// Colors
bg-primary-default       // #FEE5E2 (warm peach)
bg-primary-lightest      // #FCF6F2 (cream background)
bg-primary-medium        // #FFBFB7 (action buttons)
text-text-default        // #2D2D2D (dark text)
text-text-secondary      // #828181 (muted text)
bg-status-success        // #78A97A (green)
bg-status-error          // #D83A3A (red)

// Spacing
p-xs (8px), p-sm (12px), p-md (16px), p-lg (24px), p-xl (32px)

// Border Radius
rounded-sm (8px), rounded-md (12px), rounded-lg (16px), rounded-xl (24px)

// Fonts
font-heading (Quicksand), font-subheading (Lexend), font-body (Montserrat), font-handwritten (ComingSoon-Regular)

// Platform-specific
<View className="web:hidden" />
<View className="native:p-lg" />

// Responsive
<View className="flex-col md:flex-row gap-md">...</View>
```

### Layouts
```tsx
import { PageLayout } from '@/components/layouts/PageLayout';
import { ResponsiveLayout } from '@/components/layouts/ResponsiveLayout';

<PageLayout header={<Header />} footer={<Footer />} maxWidth={800}>
  <ResponsiveLayout maxWidth={600}>
    {/* Content */}
  </ResponsiveLayout>
</PageLayout>
```

### Responsive Design
```tsx
import { useDevice } from '@/hooks/useDevice';
const { isPhone, isMedium, isLarge } = useDevice();
```

### Services & Data Fetching
```tsx
import { recipeService } from '@/services/recipeService';
const { data, hasMore } = await recipeService.getRecipes({ limit: 20 });

import { supabase } from '@/lib/supabase';
const { data, error } = await supabase.from('recipes').select('*');
```

### Performance
- Use `React.memo` for pure components
- Use `FlashList` for long lists
- Use `expo-image` for optimized images

## Testing

**Always write tests for critical components and workflows.** See [TESTING.md](./TESTING.md) for comprehensive documentation.

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

| Category | Examples | Required Coverage |
|----------|----------|-------------------|
| **Critical Components** | Button, Text, Form inputs, Navigation | Unit tests |
| **Authentication Flows** | Login, logout, session refresh | Unit + integration |
| **Data Services** | Recipe CRUD, user profile operations | Unit tests |
| **Edge Functions** | AI chat, recipe parsing, nutrition | Unit + integration |
| **Business Logic** | Validation, calculations, transformations | Unit tests |

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

## Analytics

When adding new features, consider what user engagement signals are worth tracking. See [ANALYTICS.md](./ANALYTICS.md) for:
- Current tracked events and metrics
- How to add new event tracking
- Dashboard queries

**Philosophy**: Track what tells us if users are happy and coming back, not vanity metrics.

## Git Conventions

### Branch Naming
- `feature/description-in-kebab-case`
- `fix/issue-description`
- `hotfix/urgent-fix-description`

### Commit Messages (Conventional Commits)
```
feat(recipe): add search by ingredients
fix(auth): resolve login timeout issue
docs: update API documentation
```
