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
│   ├── common/             # Core shared: Text, Button, SearchBar, Switch, AlertModal, ErrorMessage, CheckboxButton, Divider, GradientHeader, HeaderWithBack, LanguageBadge, ShareButton, StatusModal, SelectableCard, DangerButton, SafeImage
│   ├── layouts/            # PageLayout, ResponsiveLayout
│   ├── chat/               # Chat-specific components (RecipeProgressTracker, ChatScreen, VoiceChatScreen, etc.)
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
│       └── content-health/ # HealthSummaryCards, FilterBar, IssueList, IssueRow, PublishReadinessChecklist
├── services/               # Data access and API services
│   ├── recipeService.ts
│   ├── chatService.ts
│   ├── customRecipeService.ts
│   ├── userProfileService.ts
│   ├── nutritionalFactsService.ts
│   ├── eventService.ts
│   ├── preferencesService.ts
│   ├── analyticsService.ts
│   ├── actions/            # Action execution system
│   │   └── actionRegistry.ts  # Handler map for frontend action execution
│   ├── voice/              # Voice provider system
│   ├── admin/              # Admin services (adminRecipeService, adminContentHealthService, adminTranslateService, etc.)
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
│   ├── admin/              # Admin hooks (useContentHealth, useRecipeTranslation, useActiveLocales, etc.)
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

### i18n — two systems

**UI strings** (`i18n/`) — Static app text. Add keys to BOTH `en` and `es`:
```tsx
import i18n from '@/i18n';
<Text>{i18n.t('recipes.common.search')}</Text>
```

**Entity content** (translation tables) — Dynamic DB content fetched via translation table joins. See the [Internationalization](#internationalization) section for full patterns including `pickTranslation`, the admin workflow, and `useLanguage` semantics.

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

## Native Capabilities

### Haptics
Use `expo-haptics` for tactile feedback on user interactions:
```tsx
import * as Haptics from 'expo-haptics';
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);    // Button taps
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);   // Significant actions
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); // Completion events
```

### Local Notifications
Use `expo-notifications` for alerts with system sound — works in foreground and background:
```tsx
import * as Notifications from 'expo-notifications';

// Request permission (do this once, early in the app lifecycle)
const { status } = await Notifications.requestPermissionsAsync();

// Fire immediate notification with system sound
await Notifications.scheduleNotificationAsync({
  content: { title: 'Timer done!', sound: 'default' },
  trigger: null, // null = immediate
});
```

**Current usage:** Cooking guide `RestTimer` fires a local notification when the countdown completes.

**Note:** Requires a dev build (not available in Expo Go). The same `expo-notifications` module handles remote push notifications — when adding server-sent notifications later, the permission and setup infrastructure is already in place.

---

## Chat Components

### RecipeProgressTracker

`components/chat/RecipeProgressTracker.tsx` — a "Domino's tracker" style progress indicator shown during recipe generation. It replaces `RecipeGeneratingSkeleton` in both text and voice chat.

**6 stages:** understanding -> ingredients -> cooking times -> steps -> final touches -> ready

**Two operating modes:**

| Mode | Trigger | How it works |
|------|---------|-------------|
| SSE-driven (text chat) | `currentStatus` prop from SSE events | Timer + SSE anchor snaps (e.g., `generating` -> stage 2, `enriching` -> stage 5) |
| Timer-only (voice chat) | No `currentStatus` prop | Pure time-based advancement through stages |

**Gating:**
- **Text chat:** `isRecipeGenerating` boolean in `ChatScreen` — set `true` on `generating` SSE status. Bottom status bar is hidden while tracker is visible.
- **Voice chat:** `executingToolName === 'generate_custom_recipe'` state from `useVoiceChat`.

**PROGRESS_CONFIG** (exported constant for easy tuning):
```typescript
import { PROGRESS_CONFIG } from '@/components/chat/RecipeProgressTracker';
```
- `stages[].durationMs` — time budget per stage (total ~5.6s baseline as of Feb 2026)
- `sseAnchors` — maps SSE status strings to minimum stage indices
- `progressCap` (0.92) — prevents bar from reaching 100% before actual completion
- `stallThresholdMs` (15s) — shows "Almost there..." message after this delay

**Animation notes:**
- Uses `scaleX` transform on progress bar for native driver compatibility
- Logarithmic easing within each stage for natural feel
- Label crossfade on stage transitions
- Pulse animation on active stage icon via `MaterialCommunityIcons`

---

## Internationalization

YummyYummix uses two separate i18n systems. They serve different concerns and must not be conflated.

### System 1 — UI strings (`i18n/`)

Static app text: button labels, headings, validation messages. Backed by `i18n-js` with locale files in `yyx-app/i18n/locales/`.

```tsx
import i18n from '@/i18n';

<Text>{i18n.t('recipes.common.search')}</Text>
<Text>{i18n.t('admin.translate.translateAll')}</Text>
```

Rules:
- Never hardcode user-facing strings.
- Add every key to BOTH `en/` and `es/` locale files.
- Locale bundles are split by domain (`admin.ts`, `recipes.ts`, etc.).

### System 2 — Entity content (translation tables)

Dynamic database content: recipe names, step instructions, ingredient notes. Stored in `*_translations` tables keyed by `(entity_id, locale)`.

**Reading (consumer-facing services):** use PostgREST embedded selects.
```tsx
const { data } = await supabase
  .from('recipes')
  .select(`*, translations:recipe_translations(locale, name, tips_and_tricks)`)
  .eq('translations.locale', 'en');
```

**Writing (admin services):** upsert translation rows separately from the entity row.
```tsx
// 1. Insert/update entity (non-translatable fields only)
const { data } = await supabase
  .from('recipes')
  .insert({ difficulty, portions })
  .select('id')
  .single();

// 2. Upsert translation rows
await supabase.from('recipe_translations').upsert([
  { recipe_id: data.id, locale: 'en', name: nameEn },
  { recipe_id: data.id, locale: 'es', name: nameEs },
], { onConflict: 'recipe_id,locale' });
```

### `useLanguage` hook

`contexts/LanguageContext.tsx` exposes two related but distinct values:

```tsx
import { useLanguage } from '@/contexts/LanguageContext';
const { language, locale, setLanguage, setLocale } = useLanguage();
```

| Property | Type | What it is | When to use |
|----------|------|-----------|-------------|
| `language` | `'en' \| 'es'` | i18n bundle key — maps to a locale file | Pass to `i18n.locale`, UI string lookups |
| `locale` | `string` | Full locale like `'es-MX'` or `'en-US'` — stored in user profile | API calls, DB queries, `pickTranslation` in admin |

`language` is derived from `locale`: any locale starting with `'es'` maps to `'es'`, everything else to `'en'`. The i18n system only has two bundles.

### `pickTranslation` — two variants

There are two functions named `pickTranslation` in the codebase. They serve different contexts and have different signatures.

#### Consumer variant — `utils/transformers/recipeTransformer.ts`

Used inside `RecipeTransformer` when converting raw API data to display types. Reads `i18n.locale` automatically.

```tsx
import { pickTranslation } from '@/utils/transformers/recipeTransformer';

// Reads i18n.locale internally — no locale argument needed
const t = pickTranslation(raw.translations);
const name = t?.name ?? '';
```

Fallback chain: exact match → language prefix match → reverse prefix match → `'en'` → first available.

Do not import this outside of transformer code. It is tightly coupled to `i18n.locale` at call time.

#### Admin variant — `types/recipe.admin.types.ts`

Used in admin UI and hooks where the authoring locale must be explicit (the admin may be working in a locale that differs from their UI language).

```tsx
import { pickTranslation, getTranslatedField, getNameFromTranslations } from '@/types/recipe.admin.types';

// Exact match only — you provide the locale
const t = pickTranslation(recipe.translations, 'es');

// Convenience: get a single field as a string (returns '' if missing)
const name = getTranslatedField(recipe.translations, 'es', 'name');

// Display name helper for admin UI (e.g., list labels, filenames): prefers 'es', falls back to 'en', then first available
const displayName = getNameFromTranslations(ingredient.translations);
```

Summary:

| | Consumer (`recipeTransformer.ts`) | Admin (`recipe.admin.types.ts`) | Server-side (`_shared/locale-utils.ts`) |
|---|---|---|---|
| Locale source | `i18n.locale` (implicit) | Caller-supplied argument | Caller-supplied chain from `buildLocaleChain()` |
| Fallback chain | Full (prefix + reverse + en + first) | Exact match only | Within-family chain (no cross-language) |
| No match returns | `undefined` | `undefined` | `undefined` (not `translations[0]`) |
| Use in | Transformers converting raw API data | Admin forms, hooks, UI components | Edge Functions / server-side code |
| Extra helpers | None | `getTranslatedField`, `getNameFromTranslations` | `buildLocaleChain`, `getBaseLanguage` |

### `EntityTranslation` base type

All admin translation interfaces extend `EntityTranslation` from `types/recipe.admin.types.ts`:

```tsx
interface EntityTranslation {
  locale: string;
  [key: string]: string | undefined;
}
```

Concrete types add their fields:
- `AdminRecipeTranslation` — `name`, `tipsAndTricks?`
- `AdminRecipeStepTranslation` — `instruction`, `recipeSection?`, `tip?`
- `AdminRecipeIngredientTranslation` — `notes?`, `tip?`, `recipeSection?`
- `AdminRecipeKitchenToolTranslation` — `notes?`

### Locale design rules

- `en` = base English (US English — serves all English speakers)
- `es` = base Spanish (Mexican Spanish — serves all Spanish speakers)
- Regional codes (`es-MX`, `es-ES`) are for overrides only — only add when content genuinely differs from the base
- Fallback chain (within-family only): `es-MX` → `es` (via `buildLocaleChain()` server-side). No cross-language fallback — `es` and `en` are separate user groups.
- The DB `resolve_locale()` RPC walks `parent_code` further (up to `en`) but application code stops at the language boundary.
- Never store base content under a regional code — it breaks fallback for other regions

### Admin translation workflow

The admin recipe form includes a translation step that auto-translates a recipe from one authoring locale into all other active locales via the `translate-content` Edge Function.

**Key pieces:**

| File | Role |
|------|------|
| `components/admin/recipes/forms/translationForm/TranslationStep.tsx` | UI — pre-translation summary, target locale selection, progress bar, post-translation review |
| `hooks/admin/useRecipeTranslation.ts` | Logic — batches translate calls per entity (recipe info, each step, each ingredient, each kitchen tool), tracks progress and partial failures |
| `services/admin/adminTranslateService.ts` | Service — invokes `translate-content` Edge Function; returns `TranslationResult[]` |
| `hooks/admin/useActiveLocales.ts` | Data — fetches active locales from the `locales` DB table; `es` always sorts first |

**`useRecipeTranslation` hook:**

```tsx
import { useRecipeTranslation } from '@/hooks/admin/useRecipeTranslation';

const { translating, progress, error, failedLocales, translateAll } = useRecipeTranslation();

// translateAll takes the full ExtendedRecipe, the locale it was authored in,
// and the target locales. Returns an updated ExtendedRecipe with translation
// arrays populated for all targets.
const updated = await translateAll(recipe, 'es', ['en']);
onUpdateRecipe(updated);
```

`progress` shape: `{ current: number; total: number; label: string }` — suitable for a progress bar. `failedLocales` lists any locales where translation returned an error or empty fields; the hook continues rather than aborting so partial success is still usable.

**`useActiveLocales` hook:**

```tsx
import { useActiveLocales } from '@/hooks/admin/useActiveLocales';

// Base locales only (default) — use for authoring locale selection and translation targets
const { locales, loading } = useActiveLocales();

// Include regional variants — use only when you need es-MX, es-ES etc.
const { locales } = useActiveLocales(true);

// locales: Array<{ code: string; displayName: string }>
// Always sorted: es first, then alphabetical
```

**`adminTranslateService`:**

```tsx
import { translateContent } from '@/services/admin/adminTranslateService';

const results = await translateContent(
  { name: 'Tacos de canasta', tipsAndTricks: 'Sirve caliente.' },
  'es',         // source locale
  ['en'],       // target locales
);
// results: Array<{ targetLocale: string; fields: Record<string, string>; error?: string }>
```

Fields are translated as a batch per entity — group all translatable fields for one entity into a single call rather than one call per field.

---

## Action Registry

**Location:** `services/actions/actionRegistry.ts`

The action registry maps action types (from `IrmixyResponse.actions`) to frontend handler functions. When the AI triggers an action (e.g., `share_recipe`), the registry looks up the handler and executes it.

### Pattern

```typescript
const ACTION_HANDLERS: Record<string, ActionHandler> = {
    share_recipe: {
        execute: async (_payload, context) => {
            // Use context.currentRecipe or context.recipes
            await Share.share({ message: formatRecipeForSharing(context.currentRecipe) });
            return true;  // handled
        },
    },
    view_recipe: {
        execute: (payload) => {
            router.push(`/(tabs)/recipes/${payload.recipeId}?from=chat`);
            return true;
        },
    },
};
```

- Each handler receives `(payload, context?)` and returns `boolean` (or `Promise<boolean>`)
- `payload` comes from `Action.payload` — action-specific parameters
- `context` provides the current message's recipe data (`ActionContext`)
- Return `true` if handled, `false` if not (missing data, unknown type)

### Adding a new action handler

Add an entry to `ACTION_HANDLERS` in `actionRegistry.ts`. The key must match the action `type` string sent from the backend.

For frontend-only actions triggered by the AI's `app_action` tool, you also need to add the action to the backend allow-list in `_shared/tools/app-action.ts`.

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

## Visual Polish

Implementation should feel crafted, not just technically correct. These principles complement the design system — they're about *how* you build, not *what* you build.

### Principles
- **Animate state changes** — Don't snap between loading/loaded/error. Use `Animated` or `LayoutAnimation` for smooth transitions. A skeleton shimmer feels faster than a spinner.
- **Depth through shadows** — Cards and elevated elements should use soft shadows (`shadow-sm`). Flat UI with no elevation looks generic.
- **Warm backgrounds** — Prefer subtle gradients (e.g., `primary-lightest` to white) over flat solid colors for page backgrounds and headers. This is the brand warmth.
- **Generous spacing** — When in doubt, add more whitespace. Cramped layouts feel stressful; spacious layouts feel calm. Lupita needs calm.
- **Intentional hierarchy** — Hero elements should be noticeably larger, not just a few pixels bigger. Make the visual priority obvious.
- **Brand personality in details** — Use `font-handwritten` (ComingSoon) for personal touches like greeting messages or tips. Use the peach palette confidently. If a screen could belong to any app, it needs more YummyYummix.

### Implementation Notes
- Use `react-native-reanimated` for performant animations on native
- Use `LayoutAnimation` for simple layout transitions (add/remove items)
- Keep animations 150-300ms — snappy, not sluggish
- Prefer CSS/NativeWind transitions where possible before reaching for animation libraries
- Test animations on lower-end devices — they must stay smooth

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
