# Production Deployment Guide

A reusable checklist for deploying YummyYummix to production.

---

## Pre-Deployment

### 1. Backup Production
- [ ] Run `cd yyx-server && npm run backup`
- [ ] Verify backup folder created: `backups/[Month-DD_HH-MMam/pm]/`
- [ ] Contains `database.sql.gz`
- [ ] Contains `storage/` with all bucket data

### 2. Code Review
- [ ] PR approved by reviewer
- [ ] All CI checks passing
- [ ] No secrets or sensitive data in commits
- [ ] Changelog/release notes updated (if applicable)

### 3. Test on Staging (if available)
- [ ] Migrations tested
- [ ] App functionality verified
- [ ] No console errors

---

## Deployment

### 1. Merge Code
- [ ] Merge feature branch to `main`
- [ ] Pull latest `main` locally

### 2. Database Migrations
- [ ] Run `cd yyx-server && supabase db push`
- [ ] Verify all migrations applied successfully
- [ ] Check for errors in output

### 3. Edge Functions (if changed)
- [ ] Run `cd yyx-server && supabase functions deploy --all`
- [ ] Or deploy specific function: `supabase functions deploy [function-name]`

### 4. Mobile App (if releasing new version)
- [ ] Update version in `app.json`
- [ ] Build: `eas build --platform all --profile production`
- [ ] Submit: `eas submit --platform all`

---

## Post-Deployment Verification

### 1. Smoke Tests
- [ ] App launches without crash
- [ ] User can sign in / sign out
- [ ] Main screens load (Home, Recipes, Profile)
- [ ] Recipe detail page works
- [ ] Cooking guide functions properly

### 2. Database Checks
- [ ] Run security advisors: `get_advisors(project_id, "security")`
- [ ] Run performance advisors: `get_advisors(project_id, "performance")`
- [ ] Check Supabase logs for errors

### 3. Monitor
- [ ] Watch error tracking (if configured)
- [ ] Check Supabase Dashboard → Logs
- [ ] Monitor user feedback channels

---

## Dashboard Settings (Manual, One-Time)

These are configured in Supabase Dashboard, not via migrations:

### Security
- [ ] Authentication → Settings → Enable "Leaked password protection"
- [ ] Authentication → Settings → Review password requirements

### Infrastructure
- [ ] Settings → Infrastructure → Review Postgres version for upgrades
- [ ] Settings → Infrastructure → Review compute size if needed

---

## Rollback Plan

If critical issues are found after deployment:

### Database Rollback
```bash
cd yyx-server

# Option 1: Revert last migration
supabase migration repair [version] --status reverted
supabase db push

# Option 2: Restore from backup
gunzip backups/[timestamp]/database.sql.gz
psql $DATABASE_URL < backups/[timestamp]/database.sql
```

### App Rollback
- iOS: App Store Connect → Build → Select previous build
- Android: Google Play Console → Release → Rollback

### Edge Function Rollback
```bash
# Redeploy previous version from git
git checkout [previous-commit]
supabase functions deploy [function-name]
git checkout main
```

---

## Quick Reference

### Common Commands
| Task | Command |
|------|---------|
| Backup all | `npm run backup` |
| Backup DB only | `npm run backup:db` |
| Backup storage only | `npm run backup:storage` |
| Push migrations | `supabase db push` |
| Deploy all functions | `supabase functions deploy --all` |
| Check function logs | `supabase functions logs [name]` |
| Link project | `supabase link` |

### Supabase Project
- **Project ID**: `zozskiqxdphmkuniahac`
- **Region**: `us-west-1`
- **Dashboard**: https://supabase.com/dashboard/project/zozskiqxdphmkuniahac
