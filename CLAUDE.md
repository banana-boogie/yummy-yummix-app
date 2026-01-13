# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**YummyYummix** is a cross-platform cooking app with recipe discovery, step-by-step cooking guides, and AI-powered sous chef features.

### Repository Structure
- `yyx-app/` - React Native mobile app (Expo)
- `yyx-server/` - Backend with Supabase Edge Functions (Deno/TypeScript)
- `supabase/` - Supabase configuration

## Development Commands

### Mobile App (yyx-app/)
```bash
cd yyx-app
npm install          # Install dependencies
npm start            # Start Expo dev server
npm run ios          # Run on iOS (expo run:ios)
npm run android      # Run on Android (expo run:android)
npm run web          # Run web version
npm test             # Run tests with Jest (watch mode)
npm run lint         # Run ESLint via expo lint
```

### Running a single test
```bash
cd yyx-app
npx jest path/to/test --watch    # Run specific test file
npx jest -t "test name"          # Run tests matching pattern
```

### Edge Functions (yyx-server/supabase/functions/)
```bash
cd yyx-server
supabase functions serve [function-name] --env-file .env   # Local development
supabase functions deploy [function-name]                   # Deploy to production
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
