# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**YummyYummix** is a cross-platform cooking app with recipe discovery, step-by-step cooking guides, and AI-powered sous chef features. **The app is designed with Thermomix users as the primary audience**, providing specialized cooking parameters and equipment-specific recipe adaptations.

### Repository Structure
- `yyx-app/` - React Native mobile app (Expo)
- `yyx-server/` - Backend with Supabase Edge Functions (Deno/TypeScript)
- `supabase/` - Supabase configuration

## Development Setup

### Prerequisites
- **Node.js** (v18+)
- **Supabase CLI**: `brew install supabase/tap/supabase`
- **iOS**: Xcode (for iOS development)
- **Android**: Android Studio (for Android development)

### First-Time Setup

YummyYummix uses Supabase Cloud. Credentials are configured in `.env.local` files.

```bash
# Clone and install
cd yyx-app
npm install

# Link workspace to cloud project (first time only)
cd ../yyx-server
npm run link          # Follow prompts to link to cloud project

# Run the app
cd ../yyx-app
npm run ios           # Build and run on iPhone
```

### Logging In

On the login screen, tap **"Dev Login"** to sign in with pre-configured dev credentials.

---

## Daily Development Workflow

### Quick Start
```bash
cd yyx-app
npm run ios           # Run the app on iPhone
```

### Making Database Changes

**Create a new migration:**
```bash
cd yyx-server
npm run backup        # ALWAYS backup before migrations!
npm run migration:new add_my_feature
```

**Edit the migration:**
- File will be in: `yyx-server/supabase/migrations/TIMESTAMP_add_my_feature.sql`
- Write your SQL (CREATE TABLE, ALTER TABLE, etc.)

**Push to cloud:**
```bash
npm run db:push       # Applies new migrations to cloud
```

### Deploying Edge Functions
```bash
cd yyx-server
npm run deploy ai-chat      # Deploy single function
npm run deploy:all          # Deploy all functions
```

### Viewing Logs
Use Supabase Dashboard: `Edge Functions -> <function> -> Logs`.

### Backup Before Deploy (REQUIRED)

**Always backup before deploying migrations:**
```bash
cd yyx-server
npm run backup:all    # Database + Storage
```

Backup commands:
- `npm run backup` - Database only
- `npm run backup:storage` - Storage files only
- `npm run backup:all` - Both (recommended)

### Migration Rollback

If a migration breaks the database:

1. **Create rollback migration:**
   ```bash
   npm run migration:new rollback_bad_feature
   # Edit migration to undo changes (DROP TABLE, DROP COLUMN, etc.)
   ```

2. **Push rollback:**
   ```bash
   npm run db:push
   ```

**Prevention:**
- Always backup before migrations
- Keep migrations small and reversible
- Run tests before pushing

---

## Development Commands Reference

### Mobile App (yyx-app/)
```bash
npm run ios          # Run on physical iPhone
npm run ios:sim      # Run on iOS Simulator
npm run android      # Run on physical Android
npm run android:sim  # Run on Android Emulator
npm run web          # Run web version
npm test             # Run tests with Jest (watch mode)
npm run test:ci      # Run tests once with coverage
npm run lint         # Run ESLint
```

### Supabase (yyx-server/)
```bash
# Cloud operations
npm run link         # Link workspace to cloud project
npm run db:push      # Push migrations to cloud
npm run db:pull      # Pull cloud schema
npm run deploy       # Deploy single edge function
npm run deploy:all   # Deploy all edge functions

# Backups (ALWAYS run before migrations!)
npm run backup       # Database backup
npm run backup:storage  # Storage backup
npm run backup:all   # Both database and storage

# Migrations
npm run migration:new <name>  # Create new migration

# Testing
npm test             # Run unit tests
npm run test:integration  # Integration tests
npm run get-test-jwt # Get JWT for curl testing
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

**Environment Strategy:**
- `.env.example` files are committed (templates with dummy values)
- `.env.local` and `.env` files are gitignored (contain real credentials)

### Setup
```bash
# Copy templates
cp yyx-app/.env.example yyx-app/.env.local
cp yyx-server/.env.example yyx-server/.env.local

# Edit with real values from Supabase dashboard
```

### Mobile App (yyx-app/.env.local)
```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL=https://xxx.supabase.co/functions/v1
EXPO_PUBLIC_DEV_LOGIN_EMAIL=dev@yummyyummix.local
EXPO_PUBLIC_DEV_LOGIN_PASSWORD=devpassword123
```

### Server (yyx-server/.env.local)
```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # Get from dashboard (NEVER via MCP)
OPENAI_API_KEY=sk-proj-xxx
USDA_API_KEY=xxx
```

### MCP Security Note

**NEVER ask Claude to fetch sensitive credentials via MCP tools.**

MCP tool results pass through Anthropic's servers. Get sensitive keys directly:
- Supabase keys: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
- OpenAI: https://platform.openai.com/api-keys

**Safe MCP operations:** logs, schema info, deployments, SQL queries.
**Unsafe via MCP:** service_role_key, API keys, passwords.

---

## Troubleshooting

### App can't connect to Supabase
1. Verify `.env.local` has correct cloud URLs
2. Check the project is active: https://supabase.com/dashboard
3. Clear app caches: `rm -rf .expo node_modules/.cache`
4. Restart: `npm run ios`

### Dev Login button doesn't appear
The Dev Login button only shows when:
- Running in development mode (`__DEV__` is true)
- `EXPO_PUBLIC_DEV_LOGIN_EMAIL` and `EXPO_PUBLIC_DEV_LOGIN_PASSWORD` are set in `.env.local`

### Native build folders (`ios/`, `android/`) appear
- These are auto-generated and gitignored
- Safe to delete - they'll regenerate on next `expo run:ios`
- Only needed if you have custom native code

### Migrations out of sync
```bash
cd yyx-server
npm run db:pull       # Pull current cloud schema
```

### Edge function errors
Check Supabase Dashboard logs: `Edge Functions -> ai-chat -> Logs`.

### Useful URLs
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Project Settings**: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React Native + Expo |
| Styling | NativeWind (Tailwind for RN) |
| Backend | Supabase (Auth, DB, Storage, Edge Functions) |
| Routing | Expo Router (file-based in `app/`) |
| Edge Functions | Deno + TypeScript |

## AI Architecture

### AI Gateway (`yyx-server/supabase/functions/_shared/ai-gateway/`)

**All AI interactions must go through the AI Gateway.** Never call OpenAI, Anthropic, or other providers directly.

#### Why Use the Gateway?
- ✅ **Provider Independence** - Switch models/providers via env vars without code changes
- ✅ **Usage-Based Routing** - Different models for different tasks (`text`, `parsing`, `reasoning`)
- ✅ **Cost Optimization** - Use cheaper models for simple tasks
- ✅ **Consistent Interface** - Same API for all providers
- ✅ **Structured Output** - JSON schema validation built-in
- ✅ **Streaming Support** - SSE streaming with `chatStream()`

#### How to Use:

```typescript
import { chat, chatStream } from '../_shared/ai-gateway/index.ts';

// For structured output (always use JSON schema):
const response = await chat({
  usageType: 'text',  // or 'parsing', 'reasoning', 'voice'
  messages: [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'user', content: 'Hello!' },
  ],
  temperature: 0.7,
  responseFormat: {
    type: 'json_schema',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        suggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              message: { type: 'string' },
            },
            required: ['label', 'message'],
          },
        },
      },
      required: ['message', 'suggestions'],
    },
  },
});

// For streaming:
for await (const chunk of chatStream({
  usageType: 'text',
  messages: [...],
  temperature: 0.7,
})) {
  console.log(chunk);
}
```

#### Usage Types:

| Type | Default Model | Use Case | Cost |
|------|--------------|----------|------|
| `text` | gpt-4o-mini | Chat completions, general text generation | Low |
| `parsing` | gpt-4o-mini | Intent classification, structured data extraction | Very low |
| `reasoning` | o1-mini | Complex reasoning, multi-step problems | High |
| `voice` | gpt-4o-mini | Voice-optimized short responses | Low |

#### Configuration:

```bash
# Required API Keys (in .env or Supabase secrets)
OPENAI_API_KEY=sk-proj-xxx      # For text, voice, parsing, reasoning

# Optional: Override default models
AI_TEXT_MODEL=gpt-4o              # Override chat model (default: gpt-4o-mini)
AI_PARSING_MODEL=gpt-4o-mini      # Override parsing model
AI_REASONING_MODEL=o1             # Override reasoning model
```

#### Design Pattern:

The gateway uses **OpenAI's format as the universal interface** (same pattern as Vercel AI SDK and LangChain). Each provider translates from this common format to their specific API:

```
Developer Code → Gateway (OpenAI format) → Provider (translates to native format) → AI Service
```

This design:
- Uses OpenAI format because it's the industry standard
- Each provider handles translation (already implemented for OpenAI)
- Adding new providers (Anthropic, Google) just requires a new translator
- NOT OpenAI-specific - it's using OpenAI format as the **lingua franca**

**When adding new providers:** Implement translation logic in `ai-gateway/providers/<provider>.ts`. The gateway interface stays the same.

#### Thermomix-First Design

When generating recipes for users with Thermomix equipment:
- The system prompt automatically includes Thermomix instructions
- AI generates `thermomixTime`, `thermomixTemp`, and `thermomixSpeed` parameters
- Validation ensures parameters are within valid ranges
- Frontend displays Thermomix cooking parameters in step-by-step guide

See `generate-custom-recipe.ts` for Thermomix system prompt section.

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
- **`ai-chat/`**, **`ai-orchestrator/`**, **`start-voice-session/`**, **`voice-tool-execute/`** - AI endpoints
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

## AI Collaboration Prompts

When working with multiple AIs iteratively:
1. **Plan** - Use plan mode to create implementation plan
2. **Implement** - Follow the plan and commit changes
3. **Review** - Have another AI review the changes
4. **Iterate** - Address feedback and repeat until satisfied

See [docs/ai-prompts.md](docs/ai-prompts.md) for copy-paste prompts.
