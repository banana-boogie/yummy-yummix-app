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
```bash
npm run logs ai-chat  # View function logs
```

### Backup Before Deploy (REQUIRED)

**Always backup before deploying migrations:**
```bash
npm run backup:all    # Database + Storage
```

Supabase Free tier has NO automated backups. You must manage your own.

---

## Edge Functions

Located in `supabase/functions/`:

- **ai-orchestrator/** - Main AI routing and conversation management
- **ai-chat/** - Chat completions endpoint
- **ai-voice/** - Voice input/output handling
- **get-nutritional-facts/** - USDA nutrition API integration
- **parse-recipe-markdown/** - Recipe parsing utilities
- **_shared/** - Shared utilities (CORS, auth, AI gateway)

### Deploying Functions

```bash
npm run deploy ai-orchestrator    # Deploy single function
npm run deploy:all                # Deploy all functions
```

### Viewing Logs

```bash
npm run logs ai-orchestrator      # CLI logs
# Or ask Claude: "Check edge function logs for errors"
```

---

## Database Migrations

Located in `supabase/migrations/`.

### Creating Migrations

```bash
npm run backup                    # ALWAYS backup first!
npm run migration:new add_feature # Create new migration
# Edit the SQL file
npm run db:push                   # Push to cloud
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
CARTESIA_API_KEY=...
```

### Cloud Secrets

API keys should also be set as cloud secrets for deployed functions:
- OPENAI_API_KEY
- USDA_API_KEY
- CARTESIA_API_KEY

---

## Testing

```bash
npm test              # Run unit tests
npm run test:watch    # Watch mode
npm run test:integration  # Integration tests
```

---

See the main [CLAUDE.md](../CLAUDE.md) for:
- Project overview
- AI architecture and gateway
- General conventions
