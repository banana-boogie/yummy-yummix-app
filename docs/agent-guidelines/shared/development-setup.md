## Development Setup

### Prerequisites
- **Node.js** (v18+)
- **Supabase CLI**: `brew install supabase/tap/supabase`
- **iOS**: Xcode (for iOS development)
- **Android**: Android Studio (for Android development)

### First-Time Setup

YummyYummix uses Supabase Cloud. Credentials are configured in `.env.local` files.

```bash
# Clone and install
cd yyx-app
npm install

# Link workspace to cloud project (first time only)
cd ../yyx-server
npm run link          # Follow prompts to link to cloud project

# Run the app
cd ../yyx-app
npm run ios           # Build and run on iPhone
```

### Logging In

On the login screen, tap **"Dev Login"** to sign in with pre-configured dev credentials.

---

## Daily Development Workflow

### Quick Start
```bash
cd yyx-app
npm run ios           # Run the app on iPhone
```

### Making Database Changes

**Create a new migration:**
```bash
cd yyx-server
npm run backup        # ALWAYS backup before migrations!
npm run migration:new add_my_feature
```

**Edit the migration:**
- File will be in: `yyx-server/supabase/migrations/TIMESTAMP_add_my_feature.sql`
- Write your SQL (CREATE TABLE, ALTER TABLE, etc.)

**Push to cloud:**
```bash
npm run db:push       # Applies new migrations to cloud
```

### Deploying Edge Functions
```bash
cd yyx-server
npm run deploy irmixy-chat-orchestrator  # Deploy single function
npm run deploy:all                       # Deploy all functions
```

### Viewing Logs
Use Supabase Dashboard: `Edge Functions -> <function> -> Logs`.

### Backup Before Deploy (REQUIRED)

**Always backup before deploying migrations:**
```bash
cd yyx-server
npm run backup:all    # Database + Storage
```

Backup commands:
- `npm run backup` - Database only
- `npm run backup:storage` - Storage files only
- `npm run backup:all` - Both (recommended)

### Migration Rollback

If a migration breaks the database:

1. **Create rollback migration:**
   ```bash
   npm run migration:new rollback_bad_feature
   # Edit migration to undo changes (DROP TABLE, DROP COLUMN, etc.)
   ```

2. **Push rollback:**
   ```bash
   npm run db:push
   ```

**Prevention:**
- Always backup before migrations
- Keep migrations small and reversible
- Run tests before pushing

---

## Development Commands Reference

### Mobile App (yyx-app/)
```bash
npm run ios          # Run on physical iPhone
npm run ios:sim      # Run on iOS Simulator
npm run android      # Run on physical Android
npm run android:sim  # Run on Android Emulator
npm run web          # Run web version
npm test             # Run tests with Jest (watch mode)
npm run test:ci      # Run tests once with coverage
npm run lint         # Run ESLint
```

### Supabase (yyx-server/)
```bash
# Cloud operations
npm run link         # Link workspace to cloud project
npm run db:push      # Push migrations to cloud
npm run db:pull      # Pull cloud schema
npm run deploy       # Deploy single edge function
npm run deploy:all   # Deploy all edge functions

# Backups (ALWAYS run before migrations!)
npm run backup       # Database backup
npm run backup:storage  # Storage backup
npm run backup:all   # Both database and storage

# Migrations
npm run migration:new <name>  # Create new migration

# Testing
npm test             # Run unit tests
npm run test:integration  # Integration tests
npm run get-test-jwt # Get JWT for curl testing
```

### Running Tests

**Frontend (yyx-app/)**
```bash
npm test                          # Run all tests (watch mode)
npm run test:ci                   # Run tests once with coverage (CI mode)
npm run test:coverage             # Generate coverage report
npx jest path/to/test             # Run specific test file
npx jest -t "test name"           # Run tests matching pattern
```

**Backend (yyx-server/)**
```bash
deno task test                    # Run all Deno unit tests
deno task test:watch              # Run tests in watch mode
deno task test:coverage           # Run with coverage
deno task test:integration        # Run integration tests (requires staging env)
```

For detailed testing documentation, see [TESTING.md](./docs/operations/TESTING.md).

---

## Environment Variables

**Environment Strategy:**
- `.env.example` files are committed (templates with dummy values)
- `.env.local` and `.env` files are gitignored (contain real credentials)

### Setup
```bash
# Copy templates
cp yyx-app/.env.example yyx-app/.env.local
cp yyx-server/.env.example yyx-server/.env.local

# Edit with real values from Supabase dashboard
```

### Mobile App (yyx-app/.env.local)
```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL=https://xxx.supabase.co/functions/v1
EXPO_PUBLIC_DEV_LOGIN_EMAIL=dev@yummyyummix.local
EXPO_PUBLIC_DEV_LOGIN_PASSWORD=devpassword123
```

### Server (yyx-server/.env.local)
```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # Get from dashboard (NEVER via MCP)
OPENAI_API_KEY=sk-proj-xxx
USDA_API_KEY=xxx
```

### MCP Security Note

**NEVER ask Claude to fetch sensitive credentials via MCP tools.**

MCP tool results pass through Anthropic's servers. Get sensitive keys directly:
- Supabase keys: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
- OpenAI: https://platform.openai.com/api-keys

**Safe MCP operations:** logs, schema info, deployments, SQL queries.
**Unsafe via MCP:** service_role_key, API keys, passwords.

---

## Troubleshooting

### App can't connect to Supabase
1. Verify `.env.local` has correct cloud URLs
2. Check the project is active: https://supabase.com/dashboard
3. Clear app caches: `rm -rf .expo node_modules/.cache`
4. Restart: `npm run ios`

### Dev Login button doesn't appear
The Dev Login button only shows when:
- Running in development mode (`__DEV__` is true)
- `EXPO_PUBLIC_DEV_LOGIN_EMAIL` and `EXPO_PUBLIC_DEV_LOGIN_PASSWORD` are set in `.env.local`

### Native build folders (`ios/`, `android/`) appear
- These are auto-generated and gitignored
- Safe to delete - they'll regenerate on next `expo run:ios`
- Only needed if you have custom native code

### Migrations out of sync
```bash
cd yyx-server
npm run db:pull       # Pull current cloud schema
```

### Edge function errors
Check Supabase Dashboard logs: `Edge Functions -> irmixy-chat-orchestrator -> Logs`.

### Useful URLs
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Project Settings**: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
