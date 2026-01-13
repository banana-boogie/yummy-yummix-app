# Responsive Design Patterns

## Overview

This document describes the recommended patterns for implementing responsive layouts in the YummyYummix app.

## The `useDevice` Hook

Use the `useDevice` hook from `@/hooks/useDevice` for conditional rendering based on screen size.

### Recommended Properties

```tsx
const { isMobile, isDesktop } = useDevice();
```

| Property | True When | Use Case |
|----------|-----------|----------|
| `isMobile` | width < 768px | Stacked layouts, mobile-optimized UI |
| `isDesktop` | width >= 768px | Multi-column layouts, desktop features |

### ⚠️ Avoid These

- `isSmall` - Only matches 576-768px, misses phones!
- Creating `const isMobile = !isMediumUp` manually - use `isMobile` directly

## Pattern: Conditional Layout Switching

For forms/pages that need fundamentally different layouts:

```tsx
const { isMobile } = useDevice();

return (
  <View>
    {isMobile ? (
      <MobileLayout>
        <SelectedSection {...props} />
        <AvailableSection {...props} />
      </MobileLayout>
    ) : (
      <DesktopLayout>
        <AvailableSection {...props} />
        <SelectedSection {...props} />
      </DesktopLayout>
    )}
  </View>
);
```

### Key Principle: Extract Shared Components

When mobile and desktop layouts share the same sections but in different arrangements, extract those sections into reusable components:

```tsx
// ❌ BAD: Duplicated JSX in both branches
{isMobile ? (
  <View>
    {/* 50 lines of Selected Items JSX */}
    {/* 50 lines of Available Items JSX */}
  </View>
) : (
  <View>
    {/* Same 50 lines of Available Items JSX */}
    {/* Same 50 lines of Selected Items JSX */}
  </View>
)}

// ✅ GOOD: Extracted components
{isMobile ? (
  <View className="flex-col">
    <SelectedItemsSection {...props} />
    <AvailableItemsSection {...props} />
  </View>
) : (
  <View className="flex-row">
    <AvailableItemsSection {...props} />
    <SelectedItemsSection {...props} />
  </View>
)}
```

## Pattern: NativeWind Responsive Classes

For simpler styling differences (padding, gaps, sizes), use NativeWind directly:

```tsx
// Responsive padding
<View className="p-sm md:p-lg">

// Responsive flex direction
<View className="flex-col md:flex-row">

// Responsive gap
<View className="gap-sm md:gap-lg">

// Responsive sizing
<Image className="w-10 h-10 md:w-14 md:h-14" />
```

## When to Use Each Pattern

| Scenario | Use |
|----------|-----|
| Different section order | `isMobile` conditional |
| Different component visibility | `isMobile` conditional |
| Different spacing/sizing | NativeWind classes |
| Different flex direction only | NativeWind classes |
| Fundamentally different UI | `isMobile` conditional |

## File Organization

For complex responsive forms, consider this structure:

```
components/admin/recipes/forms/usefulItemsForm/
├── RecipeUsefulItemsForm.tsx      # Main form with layout logic
├── SelectedItemsSection.tsx        # Shared section component
├── AvailableItemsSection.tsx       # Shared section component
├── AdminRecipeUsefulItemCard.tsx   # Individual item card
└── RecipeUsefulItemFormModal.tsx   # Modal for editing
```

## Consumer App Patterns

The consumer-facing pages (recipes, cooking guide) use a simpler approach:

### Design Tokens for Layout

All layout constants are centralized in `@/constants/design-tokens`:

```tsx
import { LAYOUT, COLORS } from '@/constants/design-tokens';

// Use LAYOUT.maxWidth for content constraints
style={{ maxWidth: LAYOUT.maxWidth.cookingGuide }}

// Use LAYOUT.sidebar for sidebar dimensions
style={{ width: LAYOUT.sidebar.width }}

// Use COLORS.sidebar for sidebar styling
style={{ 
  backgroundColor: COLORS.sidebar.background,
  borderRightColor: COLORS.sidebar.border
}}
```

### Layout Components

1. **PageLayout** - Top-level wrapper handling:
   - Sidebar offset on large screens
   - Background color
   - Header/footer slots
   - Max-width constraints

2. **ResponsiveLayout** - Content width constraints:
   - Default: 500px (mobile) → 700px (tablet) → 800px (desktop)
   - Customizable via `maxWidth` prop

### Sidebar Handling

Large screens (≥1100px) show a vertical sidebar. Account for it with:

```tsx
import { LAYOUT } from '@/constants/design-tokens';

// In PageLayout (automatic via adjustForTabBar)
<View className="lg:pl-[80px]">

// Manual offset using design token
style={{ paddingLeft: isLarge ? LAYOUT.sidebar.width : 0 }}
```

### Content Width Standards (LAYOUT.maxWidth)

All values are defined in `design-tokens.js`:

| Token | Value | Usage |
|-------|-------|-------|
| `recipeList` | 1200px | Recipe cards grid |
| `recipeDetail` | 900px | Recipe detail content |
| `cookingGuide` | 1000px | Cooking guide + mise-en-place |
| `modal` | 500px | Form dialogs |
| `mobile` | 500px | ResponsiveLayout default (xs) |
| `tablet` | 700px | ResponsiveLayout default (md) |
| `desktop` | 800px | ResponsiveLayout default (lg) |

### Centering Content on Desktop

For pages that need centered content on desktop:

```tsx
const { isMobile } = useDevice();

<View 
  className="px-md"
  style={!isMobile ? { 
    maxWidth: LAYOUT.maxWidth.cookingGuide, 
    alignSelf: 'center',
    width: '100%'
  } : undefined}
>
  {/* Content */}
</View>
```

### Responsive Sizing Tokens

Use NativeWind responsive classes for sizing:

```tsx
// Image sizes
className="w-[72px] h-[72px] lg:w-[100px] lg:h-[100px]"

// Heights
className="h-[120px] lg:h-[250px]"

// Spacing
className="gap-md lg:gap-xl"
```

For JS-based sizing (icons, dynamic calculations):

```tsx
const { isPhone } = useDevice();
const iconSize = isPhone ? 135 : 200;
```
