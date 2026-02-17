# Production Deployment Checklist

This document outlines the steps for deploying YummyYummix to production.

## Pre-Deployment

### Environment Variables

Verify all required environment variables are set:

**Mobile App (`yyx-app/.env.local`)**
- [ ] `EXPO_PUBLIC_SUPABASE_URL` - Production Supabase URL
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Production anon key
- [ ] `EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL` - Edge functions URL

**Server (`yyx-server/.env.local`)**
- [ ] `SUPABASE_URL` - Production Supabase URL
- [ ] `SUPABASE_ANON_KEY` - Production anon key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Service role key (get from dashboard, never via MCP)
- [ ] `OPENAI_API_KEY` - OpenAI API key
- [ ] `CARTESIA_API_KEY` - Cartesia TTS API key
- [ ] `USDA_API_KEY` - USDA nutrition API key

### Database Backup

**ALWAYS backup before any deployment:**

```bash
cd yyx-server
npm run backup:all    # Backup both database and storage
```

Verify backup files are created in `yyx-server/backups/`:
- `<Month-Day_HH-MMam-or-pm>/database.sql.gz` - Database dump
- `<Month-Day_HH-MMam-or-pm>/storage/` - Storage files

### Migration Review

1. Review pending migrations:
   ```bash
   cd yyx-server
   ls supabase/migrations/*.sql
   ```

2. Test migrations locally (if using local development):
   ```bash
   supabase db reset   # Reset and reapply all migrations
   ```

3. Check for destructive operations:
   - `DROP TABLE`
   - `DROP COLUMN`
   - `TRUNCATE`
   - Any data deletions

### Security & Performance Checks

Run Supabase advisors before deployment:

```bash
# Check security advisors (via Claude MCP or Supabase dashboard)
# Look for:
# - RLS policies with USING(true)
# - Functions without SET search_path
# - Leaked password protection
# - Postgres version

# Check performance advisors
# Look for:
# - Missing indexes on foreign keys
# - Unused indexes
# - RLS policies using auth.uid() instead of (SELECT auth.uid())
```

---

## Deployment Steps

### 1. Database Migrations

```bash
cd yyx-server

# Backup first!
npm run backup:all

# Push migrations to production
npm run db:push
```

**If migration fails:**
1. Check error message
2. Create a fix migration if needed
3. Do NOT manually modify the database without a migration

### 2. Edge Function Deployment

```bash
cd yyx-server

# Deploy all edge functions
npm run deploy:all

# Or deploy specific functions
supabase functions deploy ai-chat
supabase functions deploy ai-orchestrator
supabase functions deploy ai-voice
supabase functions deploy get-nutritional-facts
supabase functions deploy parse-recipe-markdown
```

**Verify deployment:**
```bash
supabase functions logs ai-chat   # Check for errors
```

### 3. Mobile App Build & Submission

#### iOS Build

```bash
cd yyx-app

# Create production build
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

#### Android Build

```bash
cd yyx-app

# Create production build
eas build --platform android --profile production

# Submit to Play Store
eas submit --platform android
```

---

## Post-Deployment Verification

### API Health Check

1. Test authentication:
   - Sign up new user
   - Sign in existing user
   - OAuth flows (Apple, Google)

2. Test core features:
   - Recipe search
   - Recipe detail view
   - AI chat functionality
   - Voice features (if applicable)

3. Test edge functions:
   ```bash
   # Get test JWT
   cd yyx-server
   npm run get-test-jwt

   # Test endpoint
   curl -H "Authorization: Bearer <JWT>" \
     https://<project>.supabase.co/functions/v1/ai-chat
   ```

### Monitoring Setup

1. Enable Supabase monitoring:
   - Dashboard > Reports
   - Set up alerts for high error rates

2. Check logs regularly:
   ```bash
   supabase functions logs ai-chat
   supabase functions logs ai-voice
   ```

---

## Rollback Procedures

### Database Rollback

1. **If migration fails mid-way:**
   ```bash
   # Create a rollback migration
   npm run migration:new rollback_<feature_name>

   # Write reverse operations (DROP TABLE, DROP COLUMN, etc.)
   # Push rollback
   npm run db:push
   ```

2. **If you need to restore from backup:**
   ```bash
   # WARNING: This is destructive!
   # Only use if other options have failed

   # Restore specific backup
   # 1) Decompress the selected backup
   gunzip -k backups/<Month-Day_HH-MMam-or-pm>/database.sql.gz

   # 2) Restore into the target database
   psql "$DATABASE_URL" < backups/<Month-Day_HH-MMam-or-pm>/database.sql
   ```

### Edge Function Rollback

1. **Identify last working version:**
   - Check Supabase dashboard > Edge Functions > Deployments

2. **Redeploy previous version:**
   - You can redeploy from the dashboard
   - Or revert code and redeploy: `npm run deploy <function-name>`

### App Store Rollback

1. **iOS (App Store Connect):**
   - Go to App Store Connect > Your App > iOS App
   - Remove the problematic version from sale
   - Previous version automatically becomes available

2. **Android (Play Console):**
   - Go to Play Console > Your App > Production
   - Halt rollout of current release
   - Start new release with previous APK/AAB

---

## Supabase-Specific Notes

### Postgres Upgrades

When upgrading Postgres version in Supabase:

1. **Remove incompatible extensions first:**
   ```sql
   -- The pgjwt extension may need removal before upgrading
   DROP EXTENSION IF EXISTS pgjwt;
   ```

2. Perform the upgrade in Supabase dashboard

3. Re-enable extensions if needed

### Dashboard Actions (Not Automatable)

Some security/performance fixes require dashboard actions:

1. **Enable Leaked Password Protection:**
   - Dashboard > Auth > Settings > Enable leaked password protection

2. **Upgrade Postgres Version:**
   - Dashboard > Settings > Infrastructure > Upgrade

---

## Emergency Contacts

- **Supabase Support:** https://supabase.com/dashboard/support
- **Expo Support:** https://expo.dev/contact
- **App Store Review:** https://developer.apple.com/contact/
- **Play Store Support:** https://support.google.com/googleplay/android-developer/

---

## Deployment Checklist Summary

```
[ ] Pre-Deployment
    [ ] Environment variables verified
    [ ] Database backed up
    [ ] Migrations reviewed
    [ ] Security advisors checked
    [ ] Performance advisors checked

[ ] Deployment
    [ ] Migrations pushed
    [ ] Edge functions deployed
    [ ] Mobile app built
    [ ] App submitted to stores

[ ] Post-Deployment
    [ ] Authentication tested
    [ ] Core features verified
    [ ] Edge function logs checked
    [ ] Monitoring enabled

[ ] If Issues Occur
    [ ] Identify affected component
    [ ] Execute appropriate rollback
    [ ] Notify stakeholders
    [ ] Document incident
```
