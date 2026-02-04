# Production Deployment Plan

## Branch: `feature/general-improvements`

---

## Pre-Deployment Checklist

### 1. Backup Production Data
```bash
cd yyx-server
npm run backup
```
- [ ] Database backup created successfully
- [ ] Storage backup created successfully
- [ ] Backup folder contains both `database.sql.gz` and `storage/` directory

### 2. Review Changes
- [ ] Review PR diff on GitHub
- [ ] All tests passing in CI
- [ ] No sensitive data in commits

---

## Deployment Steps

### Step 1: Merge to Main
```bash
git checkout main
git pull origin main
git merge feature/general-improvements
git push origin main
```

### Step 2: Deploy Database Migrations
```bash
cd yyx-server
supabase db push
```

**Migrations to be applied:**
| Migration | Description |
|-----------|-------------|
| `20260202174533_fix_rls_policies.sql` | Fix RLS policies for user tables |
| `20260202180538_fix_rls_performance.sql` | Optimize RLS with `(SELECT auth.uid())` pattern |
| `20260202180630_add_fk_indexes.sql` | Add missing foreign key indexes |
| `20260202181145_cleanup_indexes.sql` | Remove duplicate indexes |
| `20260202181214_add_remaining_fk_indexes.sql` | Additional FK indexes |
| `20260202220811_fix_recipes_rls_unpublished.sql` | Hide unpublished recipes from public |
| `20260202220814_remove_duplicate_recipe_columns.sql` | Remove duplicate name/description columns |
| `20260202221733_add_ordering_constraints_and_cleanup.sql` | Add ordering constraints, cleanup duplicates |
| `20260202233952_schema_improvements.sql` | Add indexes, NOT NULL constraints, unique constraints |
| `20260203024541_fix_remaining_advisors.sql` | Final advisor warning fixes |

- [ ] All migrations applied successfully
- [ ] No errors in migration output

### Step 3: Verify Database
```bash
# Check for migration errors
supabase db push --dry-run

# Or via MCP
# get_advisors(project_id, "security")
# get_advisors(project_id, "performance")
```

- [ ] No new security warnings (except dashboard settings)
- [ ] No critical performance warnings

### Step 4: Deploy App (if applicable)
```bash
cd yyx-app
# Build for production
eas build --platform ios --profile production
eas build --platform android --profile production
```

- [ ] iOS build successful
- [ ] Android build successful

---

## Post-Deployment Checklist

### Verify Functionality
- [ ] App launches correctly
- [ ] User can sign in
- [ ] Recipes load (published only visible to non-admins)
- [ ] Recipe detail pages work
- [ ] User profile loads
- [ ] Cooking guide works with immersive mode

### Verify Database
- [ ] RLS policies working (test as non-admin user)
- [ ] Published/unpublished recipe filtering works
- [ ] No duplicate data issues

### Dashboard Settings (Manual)
These require manual action in Supabase Dashboard:

1. **Enable Leaked Password Protection**
   - Dashboard → Authentication → Settings → Security
   - Enable "Leaked password protection"
   - [ ] Completed

2. **Upgrade Postgres (if needed)**
   - Dashboard → Settings → Infrastructure
   - Check for available upgrades
   - [ ] Reviewed/Completed

---

## Rollback Plan

If issues occur after deployment:

### Rollback Database
```bash
cd yyx-server

# Option 1: Revert specific migration
supabase migration repair <version> --status reverted

# Option 2: Restore from backup
# Use the backup created in pre-deployment step
psql $DATABASE_URL < backups/[timestamp]/database.sql
```

### Rollback App
- Revert to previous app version in App Store Connect / Google Play Console
- Or deploy previous git commit

---

## Changes Summary

### Database
- Improved RLS policies for better security
- Added missing indexes for performance
- Removed duplicate data (ingredients, tags, useful items)
- Added NOT NULL constraints on junction tables
- Added case-insensitive unique indexes on names
- Hidden unpublished recipes from non-admin users

### App
- New app icon (YummyYummix logo)
- Immersive mode for cooking guide
- Various i18n and asset improvements

### DevOps
- New backup scripts (`npm run backup`, `backup:db`, `backup:storage`)
- Human-readable backup folder names (e.g., `Feb-03_08-19pm`)

---

## Contacts

- **Database Issues**: Check Supabase Dashboard logs
- **App Issues**: Check Expo/EAS build logs
- **Rollback Help**: Refer to rollback plan above
