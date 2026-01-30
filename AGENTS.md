# Repository Guidelines

## Project Overview
YummyYummix is a bilingual (English/Mexican Spanish) cross-platform cooking app for recipe discovery, step-by-step cooking guides, and AI-powered sous chef features. Designed for Thermomix users.

## Project Structure & Module Organization
- `yyx-app/` is the Expo React Native client.
  - `app/` holds route files only (Expo Router). Do not place components or types here.
  - `components/`, `hooks/`, `contexts/`, `services/`, `types/`, `utils/`, `constants/` are the main app modules.
  - `assets/` contains fonts and images.
- `yyx-server/` contains Supabase Edge Functions and DB assets.
  - `supabase/functions/` holds Deno/TypeScript functions.
  - `supabase/migrations/` contains database migrations.

## Build, Test, and Development Commands
From `yyx-app/`:
- `npm install` installs client dependencies.
- `npm start` runs the Expo dev server.
- `npm run ios` / `npm run android` / `npm run web` run platform builds.
- `npm test` runs Jest in watch mode.
- `npm run lint` runs ESLint via `expo lint`.

From `yyx-server/`:
- `npm run link` links workspace to Supabase Cloud project.
- `npm run deploy <name>` deploys an edge function.
- `npm run deploy:all` deploys all edge functions.
- `npm run db:push` pushes migrations to cloud.
- `npm run backup:all` backs up database and storage.

## Supabase Cloud Development

YummyYummix uses Supabase Cloud (no local Docker). Claude Code has MCP access for:

### Available MCP Operations

**Database Operations:**
- Execute SQL queries
- Apply migrations
- List tables and schemas
- Pull remote schema

**Edge Functions:**
- Deploy functions to cloud
- View function logs
- Get function source code
- List all deployed functions

**Logs and Debugging:**
- Auth logs (login issues, session errors)
- Edge function logs (errors, performance)
- Database logs (slow queries, errors)

**Security and Performance:**
- Run security advisors (RLS policy issues)
- Run performance advisors (missing indexes)

### Example Prompts for Claude Code

**Debugging:**
- "Check the edge function logs for the last hour"
- "Show me auth errors from today"
- "Are there any slow database queries?"

**Deployment:**
- "Deploy the ai-chat function"
- "List all deployed edge functions"
- "Show me the current migration status"

**Database:**
- "Show me the schema for the recipes table"
- "Apply this migration: [SQL]"
- "Pull the current cloud schema"

### MCP Security: Sensitive Credentials

**NEVER ask Claude to fetch sensitive credentials via MCP.**

MCP tool results are sent to Anthropic's servers as part of the conversation context.

**Safe to use MCP for:**
- ✅ Logs, schema info, table listings
- ✅ Security/performance advisors
- ✅ Deploying functions, applying migrations

**Get directly from dashboards (NOT via MCP):**
- ❌ service_role_key
- ❌ API keys (OpenAI, USDA, Cartesia)
- ❌ Secret tokens, passwords

### Backup Before Deploy (REQUIRED)

**Always backup before deploying migrations:**
```bash
cd yyx-server
npm run backup:all  # Database + Storage
```

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
- App secrets live in `.env.local` (gitignored).
- Template files `.env.example` are committed with dummy values.
- Never commit actual secrets; keep `.env` and `.env.local` in `.gitignore`.
- Get service_role_key and API keys directly from dashboards, never via MCP.
