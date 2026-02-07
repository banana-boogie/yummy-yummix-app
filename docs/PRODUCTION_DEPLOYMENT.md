# Production Deployment Checklist

Use this runbook for production releases. It is intentionally split into:
1) a fast checklist at the top,
2) details and rationale below.

## Quick Checklist

### Pre-Deployment
- [ ] Confirm PR is approved and CI is green.
- [ ] Verify production environment variables.
- [ ] Create backups (`cd yyx-server && npm run backup:all`).
- [ ] Review pending migrations for destructive operations.
- [ ] Run security/performance advisor checks in Supabase Dashboard.

### Deployment
- [ ] Push database migrations (`cd yyx-server && npm run db:push`).
- [ ] Deploy changed edge functions (`cd yyx-server && npm run deploy:all` or specific functions).
- [ ] Build/submit mobile apps if this release includes app changes.

### Post-Deployment
- [ ] Run smoke tests (auth, recipes, chat, voice).
- [ ] Check Edge Function logs in Supabase Dashboard.
- [ ] Monitor error reports and user feedback.

### Rollback Readiness
- [ ] Know the migration rollback path (new rollback migration, not history-only repair).
- [ ] Know the edge function rollback path (redeploy previous commit).
- [ ] Know app-store rollback path (halt rollout / remove from sale).

---

## Detailed Steps and Reasoning

## 1) Pre-Deployment

### 1.1 Code and Release Readiness

- Ensure PR approval and passing CI before merge.
- Confirm no secrets were committed.
- Update release notes when needed.

Why this matters:
- Reduces avoidable production defects.
- Prevents accidental credential leakage.

### 1.2 Environment Variables

Verify required values are set in your production environment.

Mobile app (`yyx-app/.env.local` or EAS secrets):
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL`

Server (`yyx-server/.env.local` / Supabase secrets):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (retrieve from dashboard, never via MCP)
- `OPENAI_API_KEY`
- `USDA_API_KEY`

Why this matters:
- Most release incidents are config errors, not code errors.

### 1.3 Backup Production (Required)

```bash
cd yyx-server
npm run backup:all
```

Verify new backup artifacts under `yyx-server/backups/`:
- `*/database.sql.gz`
- `*/storage/`

Notes:
- `backup:all` runs DB and storage backups via scripts in `yyx-server/scripts/`.
- Keep at least one known-good backup before pushing migrations.

Why this matters:
- Gives you a recovery point for data or storage corruption.

### 1.4 Migration Risk Review

Review migration SQL files in `yyx-server/supabase/migrations/` for:
- `DROP TABLE`
- `DROP COLUMN`
- `TRUNCATE`
- irreversible data updates/deletes

Why this matters:
- Prevents accidental destructive schema/data changes.

### 1.5 Security and Performance Checks

Use Supabase Dashboard advisor checks before deploy:
- Security advisor
- Performance advisor

Why this matters:
- Catches policy/index issues that can become outages under load.

---

## 2) Deployment

### 2.1 Push Database Migrations

```bash
cd yyx-server
npm run db:push
```

If migration fails:
1. Stop deployment.
2. Create a fix migration (`npm run migration:new <name>`).
3. Push again only after review.

Why this matters:
- Keeps schema changes traceable and reproducible.

### 2.2 Deploy Edge Functions

Deploy all functions:

```bash
cd yyx-server
npm run deploy:all
```

Or deploy specific functions:

```bash
cd yyx-server
npm run deploy ai-chat
npm run deploy irmixy-chat-orchestrator
npm run deploy irmixy-voice-orchestrator
npm run deploy get-nutritional-facts
npm run deploy parse-recipe-markdown
```

Why this matters:
- Ensures runtime code matches expected API behavior after DB changes.

### 2.3 Mobile App Release (If Included)

iOS:

```bash
cd yyx-app
eas build --platform ios --profile production
eas submit --platform ios
```

Android:

```bash
cd yyx-app
eas build --platform android --profile production
eas submit --platform android
```

Why this matters:
- Keeps client behavior aligned with backend changes.

---

## 3) Post-Deployment Verification

### 3.1 Smoke Test Critical Paths

Validate at minimum:
- Auth (sign in / sign out)
- Recipe search and detail
- AI chat
- Voice flow (if applicable)

Why this matters:
- Confirms business-critical flows are healthy before peak traffic.

### 3.2 Edge Function Observability

Check logs in Supabase Dashboard:
- `Edge Functions -> ai-chat -> Logs`
- `Edge Functions -> irmixy-chat-orchestrator -> Logs`
- `Edge Functions -> irmixy-voice-orchestrator -> Logs`

Why this matters:
- Catches runtime regressions quickly after deploy.

### 3.3 Ongoing Monitoring

- Watch error tracking/alerts.
- Monitor user feedback channels.

Why this matters:
- Some issues appear only with real-user traffic patterns.

---

## 4) Rollback Procedures

## 4.1 Database Rollback

Preferred approach:
1. Create a new rollback migration (`npm run migration:new rollback_<feature>`).
2. Write explicit reverse SQL.
3. Push via `npm run db:push`.

Emergency restore approach (last resort):

```bash
cd yyx-server
gunzip backups/<timestamp>/database.sql.gz
psql "$DATABASE_URL" < backups/<timestamp>/database.sql
```

Important:
- `supabase migration repair` updates migration history metadata; it does not revert schema/data by itself.

Why this matters:
- Protects migration integrity and avoids hidden drift.

## 4.2 Edge Function Rollback

1. Identify the last known-good commit.
2. Redeploy functions from that commit.

Example:

```bash
git checkout <previous-commit>
cd yyx-server
npm run deploy <function-name>
git checkout main
```

Why this matters:
- Fastest way to recover server behavior without touching app store releases.

## 4.3 App Rollback

- iOS: remove problematic version from sale in App Store Connect.
- Android: halt rollout and promote previous stable release in Play Console.

Why this matters:
- Limits user impact when client-side regressions escape testing.

---

## 5) One-Time Dashboard Settings

These are manual dashboard tasks, not migration tasks:
- Auth: enable leaked password protection.
- Infrastructure: review Postgres version and compute sizing.

Why this matters:
- Keeps baseline security and platform health in good standing.

---

## Project Reference

- Supabase Project ID: `zozskiqxdphmkuniahac`
- Region: `us-west-1`
- Dashboard: https://supabase.com/dashboard/project/zozskiqxdphmkuniahac
