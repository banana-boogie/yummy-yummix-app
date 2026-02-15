# Frontend Guidelines

Domain playbook for the YummyYummix mobile app — React Native + Expo + NativeWind.

---

## Directory Map

```
yyx-app/
├── app/                    # Expo Router screens (file-based routing)
│   ├── (tabs)/             # Tab navigation group
│   │   ├── index.tsx       # Home / Recipe discovery
│   │   ├── chat/           # AI chat (Irmixy)
│   │   ├── cooking-guide/  # Step-by-step cooking
│   │   └── profile/        # User profile
│   ├── recipe/             # Recipe detail routes
│   ├── onboarding/         # Onboarding flow
│   └── _layout.tsx         # Root layout
├── components/             # Reusable UI components
│   ├── common/             # Core shared: Text, Button, SearchBar, Switch, AlertModal, ErrorMessage, CheckboxButton, Divider, GradientHeader, HeaderWithBack, LanguageBadge, ShareButton, StatusModal, SelectableCard, DangerButton, VoiceAssistantButton
│   ├── layouts/            # PageLayout, ResponsiveLayout
│   ├── chat/               # Chat-specific components
│   ├── recipe/             # Recipe cards, lists
│   ├── recipe-detail/      # Recipe detail views
│   ├── cooking-guide/      # Cooking guide components
│   ├── profile/            # Profile components
│   ├── onboarding/         # Onboarding components
│   ├── settings/           # Settings components
│   ├── auth/               # Auth components
│   ├── form/               # Form components
│   ├── navigation/         # Navigation components
│   └── admin/              # Admin dashboard
├── services/               # Data access and API services
│   ├── recipeService.ts
│   ├── chatService.ts
│   ├── customRecipeService.ts
│   ├── userProfileService.ts
│   ├── nutritionalFactsService.ts
│   ├── eventService.ts
│   ├── preferencesService.ts
│   ├── analyticsService.ts
│   ├── voice/              # Voice provider system
│   ├── admin/              # Admin services
│   └── cache/              # Caching layer
├── hooks/                  # Custom React hooks (key hooks listed)
│   ├── useRecipes.ts
│   ├── useRecipeSearch.ts
│   ├── useVoiceChat.ts
│   ├── useDevice.ts
│   ├── useCustomRecipe.ts
│   ├── useDebounce.ts
│   ├── useAudioPlayback.ts
│   ├── useImmersiveMode.ts
│   └── ... (useRecipe, useRecipeQuery, useUserProfileQuery, etc.)
├── contexts/               # React contexts
│   ├── AuthContext.tsx
│   ├── LanguageContext.tsx
│   ├── MeasurementContext.tsx
│   ├── OnboardingContext.tsx
│   └── UserProfileContext.tsx
├── types/                  # TypeScript definitions
│   ├── recipe.types.ts
│   ├── recipe.api.types.ts
│   ├── user.ts
│   ├── irmixy.ts
│   ├── thermomix.types.ts
│   ├── dietary.ts
│   ├── onboarding.ts
│   └── Language.ts
├── constants/
│   └── design-tokens.js    # ALL colors, spacing, fonts, radii (source of truth)
├── i18n/
│   ├── index.ts            # i18n setup
│   └── locales/            # Per-domain locale files
│       ├── en/             # English: auth, chat, common, onboarding, profile, recipes, settings, validation, admin
│       └── es/             # Spanish: same structure as en
├── lib/
│   └── supabase.ts         # Supabase client
└── test/                   # Test infrastructure
    ├── utils/render.tsx     # renderWithProviders
    ├── factories/           # recipeFactory, userFactory
    └── mocks/supabase.ts   # Supabase mock helpers
```

---

## Architecture Rules

### Where code goes (the Fit table)

| Code Type | Correct Location | Never Put Here |
|-----------|-----------------|----------------|
| Screens / routes | `app/` | Components, types, business logic |
| Reusable UI components | `components/<feature>/` | `app/` |
| Core shared components | `components/common/` | Anywhere else |
| Layout components | `components/layouts/` | `app/` |
| Data access / API calls | `services/` | Components, hooks |
| React contexts | `contexts/` | `app/` |
| Custom hooks | `hooks/` | `app/` |
| TypeScript types | `types/` | Inline in components |

### Component creation checklist
1. Create subdirectory: `components/<feature>/MyComponent/`
2. Add component file: `MyComponent.tsx`
3. Add barrel export: `index.ts` with `export { MyComponent } from './MyComponent'`
4. Add test file: `__tests__/MyComponent.test.tsx`

---

## Critical Conventions (violations are review blockers)

### Imports — always `@/` alias
```tsx
// CORRECT
import { Button } from '@/components/common';
import { recipeService } from '@/services/recipeService';

// WRONG — never use relative paths
import { Button } from '../../components/common';
```

### Text — always from common
```tsx
// CORRECT
import { Text } from '@/components/common';
<Text preset="body">Hello</Text>

// WRONG — never React Native's Text
import { Text } from 'react-native';
```

### Button — always from common
```tsx
import { Button } from '@/components/common';
<Button variant="primary" onPress={handlePress}>Save</Button>
<Button variant="secondary" size="small">Cancel</Button>
<Button variant="outline" icon={myIcon}>With Icon</Button>
```

### Styling — NativeWind with design tokens
```tsx
// CORRECT — use token classes
<View className="bg-primary-default p-md rounded-lg">
<Text className="text-text-default">Hello</Text>

// WRONG — no hardcoded colors or pixel values
<View style={{ backgroundColor: '#FEE5E2', padding: 16 }}>
```

### Lists — FlashList, not FlatList
```tsx
import { FlashList } from '@shopify/flash-list';
// NOT: import { FlatList } from 'react-native';
```

### Images — expo-image, not Image
```tsx
import { Image } from 'expo-image';
// NOT: import { Image } from 'react-native';
```

### i18n — all user-facing strings
```tsx
import i18n from '@/i18n';
<Text>{i18n.t('recipes.common.search')}</Text>
// Add keys to BOTH en and es in i18n/index.ts
```

---

## Design Tokens Reference

Source of truth: `constants/design-tokens.js`

### Colors (NativeWind classes)
```
bg-primary-default       #FEE5E2  (warm peach)
bg-primary-lightest      #FCF6F2  (cream background)
bg-primary-light         #FFE9E3
bg-primary-medium        #FFBFB7  (action buttons)
bg-primary-dark          #FF9A99
bg-primary-darkest       #D83A3A  (errors, emphasis)
text-text-default        #2D2D2D  (dark text)
text-text-secondary      #828181  (muted text)
bg-status-success        #78A97A  (green)
bg-status-warning        #FFA000  (orange)
bg-status-error          #D83A3A  (red)
bg-grey-default          #EDEDED
bg-grey-light            #F8F8F8
```

### Spacing
```
p-xxxs (2px), p-xxs (4px), p-xs (8px), p-sm (12px), p-md (16px)
p-lg (24px), p-xl (32px), p-xxl (48px), p-xxxl (64px)
```

### Border Radius
```
rounded-xs (4px), rounded-sm (8px), rounded-md (12px)
rounded-lg (16px), rounded-xl (24px), rounded-xxl (32px), rounded-round (9999px)
```

### Fonts
```
font-heading       Quicksand (friendly, rounded)
font-subheading    Lexend (clean, readable)
font-body          Montserrat (elegant, versatile)
font-handwritten   ComingSoon-Regular (personal touch)
```

### Text Presets
```
h1         Quicksand 800, 36px
h2         Quicksand 600, 30px
h3         Quicksand 500, 20px
subheading Lexend 300, 24px
body       Montserrat 400, 16px
bodySmall  Montserrat 400, 14px
caption    Montserrat 400, 14px, secondary color
link       Montserrat 400, 16px, underlined, dark color
handwritten ComingSoon 400, 16px
```

---

## Layout Patterns

```tsx
import { PageLayout } from '@/components/layouts/PageLayout';
import { ResponsiveLayout } from '@/components/layouts/ResponsiveLayout';

// PageLayout wraps the screen with header/footer
<PageLayout header={<Header />} footer={<Footer />} maxWidth={800}>
  <ResponsiveLayout maxWidth={600}>
    {/* Content */}
  </ResponsiveLayout>
</PageLayout>
```

Max widths from design tokens:
- `recipeList: 1200` — Recipe card grids
- `recipeDetail: 900` — Recipe detail content
- `cookingGuide: 1000` — Cooking guide steps
- `modal: 500` — Modal dialogs

---

## Platform-Specific Code

Use Metro's `.web.ts` file extension pattern:

```
services/voice/
├── VoiceProviderFactory.ts      ← Native (iOS/Android)
├── VoiceProviderFactory.web.ts  ← Web (stub or alternative)
├── providers/
│   ├── OpenAIRealtimeProvider.ts
│   └── WebVoiceProvider.ts
└── types.ts                     ← Shared interface
```

- Metro auto-selects `.web.ts` when building for web
- Both implementations must match the shared interface
- Use `Platform.OS !== 'web'` for conditional UI (show/hide features)

Platform prefixes in NativeWind:
```tsx
<View className="web:hidden" />           // Hidden on web
<View className="native:p-lg" />          // Only on native
<View className="flex-col md:flex-row" /> // Responsive breakpoint
```

---

## Responsive Design

```tsx
import { useDevice } from '@/hooks/useDevice';
const { isPhone, isMedium, isLarge } = useDevice();

// Conditionally render
{isLarge && <SidePanel />}
{isPhone ? <MobileHeader /> : <DesktopHeader />}
```

---

## Performance

- **`React.memo`** for pure components that receive complex props
- **`useMemo`** for expensive computations
- **`useCallback`** for stable function references passed as props
- **No inline closures in list items** — extract to stable references
- **No inline style objects in render** — use NativeWind classes or `useMemo`
- **FlashList** for any list with more than a handful of items
- **expo-image** for cached, progressive loading

---

## Testing

Write Jest tests using the project's test infrastructure:

```typescript
import { renderWithProviders, screen, fireEvent } from '@/test/utils/render';
import { recipeFactory } from '@/test/factories';
import { mockDatabaseQuery } from '@/test/mocks/supabase';

// Always use renderWithProviders, never plain render
// Always use factories for test data
// Clear mocks in beforeEach
```

Test files go in `__tests__/` folders next to source code. Run: `npm test` (watch), `npm run test:ci` (coverage).
