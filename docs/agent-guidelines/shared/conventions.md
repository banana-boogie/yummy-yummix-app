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

Two systems handle different concerns:

**1. UI strings** (`i18n/`) — Static app text (buttons, labels, headings). Uses `i18n-js` with locale files.
```tsx
import i18n from '@/i18n';
<Text>{i18n.t('recipes.common.search')}</Text>
```
- Never hardcode user-facing strings
- Add translations to BOTH `en` and `es` in `i18n/index.ts`

**2. Recipe/entity content** (translation tables) — Dynamic database content (recipe names, ingredients, steps).
```tsx
// Access user's locale
import { useLanguage } from '@/contexts/LanguageContext';
const { language, locale } = useLanguage();
// language = 'en' | 'es' (for i18n UI strings)
// locale = full locale like 'es-MX' (for user profile / device)
```

**Locale design:**
- `en` = base English content (US English — serves all English speakers)
- `es` = base Spanish content (Mexican Spanish — serves all Spanish speakers)
- Regional codes (e.g., `es-MX`, `es-ES`) are for **overrides only** — add them when you have region-specific content that differs from the base
- Fallback chain: `es-MX` → `es` → `en` (via `resolve_locale()` RPC and `locales.parent_code`)
- **Never store base content under a regional code** — it breaks fallback for other regions

**Reading translations (frontend services):**
```tsx
// PostgREST embedded select joins translation tables
const { data } = await supabase
  .from('recipes')
  .select(`*, translations:recipe_translations(locale, name, tips_and_tricks)`)
  .eq('translations.locale', 'en');
```

**Writing translations (admin services):**
```tsx
// 1. Insert/update entity (non-translatable fields only)
const { data } = await supabase.from('recipes').insert({ difficulty, portions }).select('id').single();
// 2. Insert/upsert translation rows
await supabase.from('recipe_translations').upsert([
  { recipe_id: data.id, locale: 'en', name: nameEn },
  { recipe_id: data.id, locale: 'es', name: nameEs },
], { onConflict: 'recipe_id,locale' });
```

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
- Use `expo-image` for optimized images
