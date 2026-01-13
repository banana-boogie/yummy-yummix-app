# YummyYummix App Development Guidelines

## Core Principles

The YummyYummix app is a React Native application built with Expo that targets both mobile platforms (iOS/Android) and web.
Using Supabase for the backend. This document outlines the key architectural and styling principles to follow when developing for the app.

## Platform Philosophy

- **Mobile-First:** The app is designed for mobile as the primary platform. Always design and implement for mobile first, then adapt for web.
- **Consistent Experience:** The app should provide a consistent user experience across platforms, with adjustments only for platform-specific UI conventions.
- **Responsive Design:** All components and screens must adapt gracefully to different screen sizes.
- **KEEP IT SIMPLE:** Keep things/code simple, organized and easy to understand.

## Directory Structure

Important directories to know:
- `components/` - Reusable UI components
- `components/common/` - Core UI components shared across the app
- `contexts/` - React contexts including ResponsiveContext for responsive design
- `hooks/` - Custom React hooks
- `constants/` - App-wide constants for colors, spacing, typography, etc.
- `utils/` - Utility functions including responsive utilities
- `app/` - App screens using Expo Router

### 0. General
- Prefer the use of '@' pathway when importing components

### 1. Component Structure

- One component per file
- Use functional components with hooks
- Group related components in directories
- Use index.ts files to export components
- Always use the built-in layout components (PageLayout, ResponsiveLayout) rather than creating custom layouts

### 2. Styling Best Practices

- **Use NativeWind (Tailwind CSS)**: styling is handled via the `className` prop using standard Tailwind classes.
  ```tsx
  <View className="flex-1 bg-background-DEFAULT p-md">
    <Text className="text-text-DEFAULT font-bold">Hello World</Text>
  </View>
  ```

- **Use App Constants**: The tailwind config is mapped to our app constants.
  - Colors: `bg-primary-DEFAULT`, `text-status-ERROR`
  - Spacing: `p-md`, `m-lg`, `gap-sm`
  - Typography: `font-bold`, `text-lg`
  - Border Radius: `rounded-md`, `rounded-full`

- **Responsive Design**: Use standard Tailwind responsive prefixes (`md:`, `lg:`) or the `useDevice` hook for logic.
  ```tsx
  // Tailwind classes (preferred for simple layout changes)
  <View className="flex-col md:flex-row gap-md">...</View>

  // useDevice Hook (for conditional rendering logic)
  const { isLarge } = useDevice();
  return isLarge ? <DesktopView /> : <MobileView />;
  ```

- **Platform Specific Styling**: NativeWind handles most cross-platform issues. For specific tweaks:
  ```tsx
  <View className="web:hidden" /> // Hidden on web
  <View className="native:p-lg" /> // Padding only on native
  ```

### 3. Error Handling

- Use try/catch blocks for async operations
- Provide user-friendly error messages
- Log errors to the console in development

## General Coding Guidelines

- Remove unused and unecessary code.

### 1. Component Structure

- One component per file
- Use functional components with hooks
- Group related components in directories
- Use index.ts files to export components
- DO NOT put any components or types in the /app folder. Use the appropriate top level folder for /components and /types.

### 2. Error Handling

- Use try/catch blocks for async operations
- Provide user-friendly error messages
- Log errors to the console in development

### 3. Performance

- Use React.memo for pure components
- Avoid excessive re-renders
- Optimize image assets
- Use virtualized lists for long lists

### 4. Testing

- Write unit tests for utility functions
- Write component tests for critical components
- Test on multiple devices and screen sizes

## Internationalization

The app supports English and Spanish:

```typescript
import i18n from '@/i18n';

<Text>{i18n.t('path.to.translation.key')}</Text>
```

Ensure all user-facing text uses the translation system.

## Backend Integration

The app uses Supabase for backend services:

```typescript
import { supabase } from '@/lib/supabase';

// Example query
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('field', value);
```

## Documentation

- Comment complex logic
- Use JSDoc comments for functions and components
- Keep documentation up-to-date as code changes
- Document any workarounds or platform-specific code

## Commit Guidelines

- Use descriptive commit messages
- Prefix commits with the area they affect (e.g., "feat:", "fix:", "docs:")
- Reference issue numbers when applicable

## Pull Request Process

1. Ensure code passes all tests
2. Update documentation if necessary
3. Get at least one code review
4. Make requested changes
5. Merge once approved 


## Styling & Responsive Design

### Page Layout Pattern

The app uses a consistent PageLayout pattern that handles both full-width headers/footers and constrained content width:

```typescript
import { PageLayout } from '@/components/layouts/PageLayout';

export default function MyScreen() {
  return (
    <PageLayout
      header={<MyHeader />}
      footer={<MyFooter />}
      maxWidth={800} // or { smallScreen: 600, mediumScreen: 800, largeScreen: 1200 }
      backgroundColor={COLORS.background.DEFAULT}
    >
      {/* Your main content here */}
      <View>
        <Text>Content goes here</Text>
      </View>
    </PageLayout>
  );
}
```

**Important:** Always use the PageLayout component for all screens as it provides:
- Full-width headers/footers with proper styling
- Content width constraints for larger screens
- Consistent spacing and layout behavior
- Automatic adjustments for the vertical tab bar on large screens

## Typography and Text Styling

YummyYummix uses a standardized typography system to ensure consistent text styling across the app.
See constants/typography.ts for more details.

### Best Practices

1. **Use the Text Component**: Never use React Native's built-in Text component.

2. **Choose by Purpose**: Select presets based on semantic purpose, not just appearance.

3. **Avoid Fixed Line Heights**: Do not set explicit line heights as they can cause text cutoff, especially on Android. Let the platform handle line height based on the font's natural metrics.

4. **Custom Styling**: For custom styles, extend from an existing preset:
   ```typescript
   <Text preset="body" style={{ letterSpacing: 0.5 }}>
     Custom styled text
   </Text>
   ```

5. **Responsive Text**: Font sizes automatically adapt to screen dimensions.

6. **Translation**: Use the i18n system for all user-facing text:
   ```typescript
   <Text>{i18n.t('path.to.translation.key')}</Text>
   ```

7. **Platform Consistency**: Text should look consistent across iOS and Android.

8. **Testing**: Always test text rendering on multiple devices and screen sizes.
