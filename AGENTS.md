# Repository Guidelines

## Project Overview
YummyYummix is a bilingual (English/Mexican Spanish) cross-platform cooking app for recipe discovery, step-by-step cooking guides, and AI-powered sous chef features.

## Project Structure & Module Organization
- `yyx-app/` is the Expo React Native client.
  - `app/` holds route files only (Expo Router). Do not place components or types here.
  - `components/`, `hooks/`, `contexts/`, `services/`, `types/`, `utils/`, `constants/` are the main app modules.
  - `assets/` contains fonts and images.
- `yyx-server/` contains Supabase Edge Functions and DB assets.
  - `supabase/functions/` holds Deno/TypeScript functions.
  - `db/` includes SQL setup and migrations.

## Build, Test, and Development Commands
From `yyx-app/`:
- `npm install` installs client dependencies.
- `npm start` runs the Expo dev server.
- `npm run ios` / `npm run android` / `npm run web` run platform builds locally.
- `npm test` runs Jest in watch mode.
- `npm run lint` runs ESLint via `expo lint`.

From `yyx-server/`:
- `supabase functions serve <name> --env-file .env` runs a function locally.
- `supabase functions deploy <name>` deploys an edge function.

## Coding Style & Naming Conventions
- Use TypeScript and functional components; one component per file.
- Imports should use the `@/` alias (e.g., `@/components/common`).
- Use NativeWind classes via `className`; keep branding consistent by using design tokens in `yyx-app/constants/design-tokens.js`.
- Always use the app `Text` component (`@/components/common/Text`) instead of React Native `Text`.
- Keep layouts consistent by using `PageLayout` and `ResponsiveLayout`.
- All user-facing strings must go through i18n so language can switch cleanly.

## Testing Guidelines
- Framework: Jest via `jest-expo`.
- Tests live next to components (e.g., `yyx-app/components/__tests__/Text-test.tsx`).
- Run a single test: `npx jest path/to/test --watch`.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, `docs: ...`.
- Branches: `feature/...`, `fix/...`, `hotfix/...`, `release/...`.
- PRs should describe changes, note testing, and include screenshots for UI changes.

## AI Collaboration

For iterative development with multiple AIs:
- **AI #1**: Plans and implements features
- **AI #2**: Reviews changes and provides feedback
- Iterate until satisfied

See [docs/ai-prompts.md](docs/ai-prompts.md) for copy-paste prompts.

## Configuration & Security Tips
- App secrets live in `.env` under `yyx-app/` (e.g., `EXPO_PUBLIC_SUPABASE_URL`).
- Do not commit secrets; keep `.env` in `.gitignore`.
