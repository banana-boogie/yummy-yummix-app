# YummyYummix

A cross-platform cooking app with recipe discovery, step-by-step cooking guides, and AI-powered sous chef features. Designed for Thermomix users.

## Quick Start

### Prerequisites

- Node.js 18+
- Supabase CLI: `brew install supabase/tap/supabase`
- Xcode (for iOS) or Android Studio (for Android)

### First-Time Setup

```bash
# Clone and install
git clone <repo-url>
cd yummy-yummix-app/yyx-app
npm install

# Link to Supabase Cloud (first time only)
cd ../yyx-server
npm run link

# Run the app
cd ../yyx-app
npm run ios
```

On the login screen, tap **"Dev Login"** to sign in instantly.

## Development Workflow

### Run the App
```bash
cd yyx-app
npm run ios           # Physical iPhone
npm run ios:sim       # iOS Simulator
npm run android       # Physical Android
```

### Database Changes
```bash
cd yyx-server
npm run backup        # ALWAYS backup first!
npm run migration:new add_feature_name
# Edit: supabase/migrations/TIMESTAMP_add_feature_name.sql
npm run db:push       # Push to cloud
```

### Deploy Edge Functions
```bash
cd yyx-server
npm run deploy ai-chat      # Single function
npm run deploy:all          # All functions
```

### View Logs
Use Supabase Dashboard: `Edge Functions -> ai-chat -> Logs`.

## Project Structure

```
yummy-yummix-app/
├── yyx-app/              # React Native mobile app (Expo)
│   ├── app/              # Expo Router screens
│   ├── components/       # Reusable UI components
│   ├── contexts/         # React contexts
│   ├── services/         # API services
│   └── .env.local        # Cloud config (gitignored)
│
└── yyx-server/           # Backend (Supabase)
    ├── supabase/
    │   ├── functions/    # Edge Functions (Deno/TypeScript)
    │   └── migrations/   # Database migrations
    ├── scripts/          # Backup and utility scripts
    └── .env.local        # Cloud config (gitignored)
```

## Tech Stack

- **Framework**: React Native + Expo
- **Styling**: NativeWind (Tailwind for React Native)
- **Backend**: Supabase Cloud (Auth, Database, Storage, Edge Functions)
- **Routing**: Expo Router (file-based)
- **Languages**: TypeScript, i18n (English + Spanish)

## Common Commands

### Mobile App (yyx-app/)
```bash
npm run ios          # Run on physical iPhone
npm run ios:sim      # Run on iOS Simulator
npm run android      # Run on physical Android
npm test             # Run tests
npm run lint         # Lint code
```

### Supabase (yyx-server/)
```bash
npm run link         # Link to cloud project
npm run db:push      # Push migrations
npm run deploy:all   # Deploy all functions
npm run backup:all   # Backup database + storage
```

## Environment Setup

Copy the example files and add your credentials:

```bash
cp yyx-app/.env.example yyx-app/.env.local
cp yyx-server/.env.example yyx-server/.env.local
```

Get credentials from:
- Supabase: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
- OpenAI: https://platform.openai.com/api-keys

## Backup Strategy

**Always backup before migrations:**
```bash
cd yyx-server
npm run backup:all    # Database + Storage
```

Supabase Free tier has NO automated backups. Run `npm run backup:all` before any migration or deployment.

## Migration Rollback

If a migration breaks the database:

1. Create rollback migration:
   ```bash
   npm run migration:new rollback_bad_feature
   # Edit to undo changes (DROP TABLE, DROP COLUMN, etc.)
   ```

2. Push rollback:
   ```bash
   npm run db:push
   ```

## Troubleshooting

### App can't connect
- Verify `.env.local` has correct cloud URLs
- Check project is active at https://supabase.com/dashboard
- Clear caches: `rm -rf .expo node_modules/.cache`

### Edge function errors
Check Supabase Dashboard logs: `Edge Functions -> ai-chat -> Logs`.

## Documentation

- **CLAUDE.md**: Detailed conventions for AI assistance
- **AGENTS.md**: Guidelines for AI coding agents
- **docs/Operations/TESTING.md**: Testing documentation

## License

[Add your license]
