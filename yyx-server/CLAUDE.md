# YummyYummix Server (Supabase Edge Functions)

This directory contains the backend for YummyYummix, built on Supabase Cloud with Edge Functions written in Deno/TypeScript.

## Cloud Development Workflow

### First-Time Setup

```bash
npm run link          # Link to cloud project (follow prompts)
```

### Daily Development

**Deploy functions:**
```bash
npm run deploy ai-chat      # Single function
npm run deploy:all          # All functions
```

**Push migrations:**
```bash
npm run backup        # ALWAYS backup first!
npm run db:push       # Push to cloud
```

**View logs:**
Use Supabase Dashboard: `Edge Functions -> ai-chat -> Logs`.

### Backup Before Deploy (REQUIRED)

**Always backup before deploying migrations:**
```bash
npm run backup:all    # Database + Storage
```

Supabase Free tier has NO automated backups. You must manage your own.

---

## Edge Functions

Located in `supabase/functions/`:

- **irmixy-chat-orchestrator/** - Main AI routing and conversation management
- **ai-chat/** - Chat completions endpoint
- **irmixy-voice-orchestrator/** - OpenAI Realtime session bootstrap + quota checks + secure voice tool execution
- **get-nutritional-facts/** - USDA nutrition API integration
- **parse-recipe-markdown/** - Recipe parsing utilities
- **_shared/** - Shared utilities (CORS, auth, AI gateway)

### Deploying Functions

```bash
npm run deploy irmixy-chat-orchestrator    # Deploy single function
npm run deploy:all                # Deploy all functions
```

### Viewing Logs

Use Supabase Dashboard: `Edge Functions -> irmixy-chat-orchestrator -> Logs`.

---

## Database Migrations

Located in `supabase/migrations/`.

### CRITICAL: Never Use MCP for Migrations

**NEVER use the Supabase MCP `apply_migration` tool to apply database migrations.**

The MCP tool bypasses the local migration file workflow and causes the local `supabase/migrations/` folder to diverge from the remote migration history. This breaks `supabase db push` and makes the migration history unmaintainable.

**Always use the CLI workflow:**
1. Create migration file locally with `npm run migration:new`
2. Edit the SQL file in `supabase/migrations/`
3. Push with `npm run db:push`

The MCP Supabase tools are safe for:
- Reading data (`execute_sql` for SELECT queries)
- Checking migration history (`list_migrations`)
- Viewing tables (`list_tables`)
- Getting project info

**Never use MCP for:**
- `apply_migration` - Creates history divergence
- Any DDL changes (CREATE, ALTER, DROP) outside the migration workflow

### Creating Migrations

```bash
npm run backup                    # ALWAYS backup first!
npm run migration:new add_feature # Create new migration
# Edit the SQL file in supabase/migrations/
npm run db:push                   # Push to cloud
```

### If Migration History Diverges

If local and remote migration histories get out of sync:

```bash
# 1. Backup local migrations (in case you need the SQL)
cp -r supabase/migrations ~/migrations_backup

# 2. Clear local migrations
rm -rf supabase/migrations/*

# 3. Pull current remote state as new baseline
supabase db pull

# 4. Now create new migrations from this synced state
npm run migration:new my_new_feature
```

### Migration Rollback

If a migration breaks the database:

1. **Create rollback migration:**
   ```bash
   npm run migration:new rollback_bad_feature
   # Edit migration to undo changes
   ```

2. **Push rollback:**
   ```bash
   npm run db:push
   ```

---

## Environment Variables

### Required in `.env.local`:

```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Get from dashboard

OPENAI_API_KEY=sk-proj-...
USDA_API_KEY=...
```

### Cloud Secrets

API keys should also be set as cloud secrets for deployed functions:
- OPENAI_API_KEY
- USDA_API_KEY

---

## Testing

```bash
npm test              # Run unit tests
npm run test:watch    # Watch mode
npm run test:integration  # Integration tests
```

---

## Database Functions

Custom PostgreSQL functions for RPC calls are documented in `docs/DATABASE_FUNCTIONS.md`.

**Quick reference:**
- `find_closest_ingredient(name, lang)` — Fuzzy ingredient search with language preference
- `admin_analytics(action, timeframe, limit)` — Admin dashboard metrics
- `is_admin()` — Check current user's admin status

To list all available functions:
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';
```

---

See the main [CLAUDE.md](../CLAUDE.md) for:
- Project overview
- AI architecture and gateway
- General conventions
