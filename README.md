# YummyYummix

A cross-platform cooking app with recipe discovery, step-by-step cooking guides, and AI-powered sous chef features.

## Quick Start

### Prerequisites

- Node.js 18+
- Docker Desktop (for local Supabase)
- Supabase CLI: `brew install supabase/tap/supabase`
- Xcode (for iOS) or Android Studio (for Android)

### Setup

1. **Clone and install**
   ```bash
   git clone <repo-url>
   cd yummy-yummix-app
   cd yyx-app && npm install
   ```

2. **Start local Supabase**
   ```bash
   cd ../yyx-server
   supabase start
   ```

   Note the local API URL and credentials shown.

3. **Configure environment (if needed)**

   `.env.local` is already configured for local development. If your local network IP changes:
   ```bash
   # Find your IP
   ifconfig | grep "inet " | grep -v 127.0.0.1

   # Update yyx-app/.env.local with your IP
   EXPO_PUBLIC_SUPABASE_URL=http://YOUR_IP:54321
   ```

4. **Run the app**
   ```bash
   cd ../yyx-app
   npm run ios:device    # Physical iPhone
   npm run ios           # iOS Simulator
   npm run android       # Android
   ```

## Development Workflow

### Daily Development

```bash
# 1. Start Supabase (if not running)
cd yyx-server && supabase start

# 2. Run the app
cd ../yyx-app && npm run ios:device
```

### Database Changes

**Create migration:**
```bash
cd yyx-server
supabase migration new add_feature_name
```

**Edit the migration:**
- File: `yyx-server/supabase/migrations/TIMESTAMP_add_feature_name.sql`
- Add your SQL (CREATE TABLE, ALTER TABLE, etc.)

**Test locally:**
```bash
supabase db reset  # Drops DB, reapplies all migrations from scratch
```

**Deploy to production:**
```bash
supabase db push
```

### Edge Functions

**Test locally:**
```bash
cd yyx-server
supabase functions serve [function-name] --env-file .env
```

**Deploy:**
```bash
supabase functions deploy [function-name]
```

## Project Structure

```
yummy-yummix-app/
├── yyx-app/              # React Native mobile app (Expo)
│   ├── app/              # Expo Router screens (file-based routing)
│   ├── components/       # Reusable UI components
│   ├── contexts/         # React contexts (Auth, Language, etc.)
│   ├── services/         # API services
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Supabase client setup
│   ├── .env              # Production config (gitignored)
│   └── .env.local        # Local dev config (committed)
│
└── yyx-server/           # Backend
    └── supabase/
        ├── functions/    # Edge Functions (Deno/TypeScript)
        └── migrations/   # Database migrations
```

## Tech Stack

- **Framework**: React Native + Expo
- **Styling**: NativeWind (Tailwind for React Native)
- **Backend**: Supabase (Auth, Database, Storage, Edge Functions)
- **Routing**: Expo Router (file-based)
- **Languages**: TypeScript, i18n (English + Spanish)

## Common Commands

### Mobile App
```bash
npm start            # Start Expo dev server
npm run ios:device   # Run on physical iPhone (local dev)
npm run ios:prod     # Build with production Supabase
npm run android      # Run on Android
npm test             # Run tests
npm run lint         # Lint code
```

### Supabase
```bash
supabase start       # Start all local services
supabase stop        # Stop services
supabase status      # Check status
supabase db reset    # Reset and reapply all migrations
supabase db push     # Deploy migrations to production
```

## Environment Variables

### `.env.local` (Local Development - Committed)
Points to local Supabase instance. Safe to commit (no secrets).

```env
EXPO_PUBLIC_SUPABASE_URL=http://192.168.1.x:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc... # Local dev key (public)
```

### `.env` (Production - Gitignored)
Contains production URLs and API keys. Never commit.

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=xxx
OPENAI_API_KEY=sk-proj-xxx
USDA_API_KEY=xxx
```

## Troubleshooting

### Can't connect to local Supabase

1. Check Supabase is running: `supabase status`
2. Verify your IP matches `.env.local`: `ifconfig | grep "inet "`
3. Ensure Mac and device are on same WiFi
4. Check firewall allows port 54321

### Migrations out of sync

```bash
cd yyx-server
supabase db pull    # Pull current production schema
supabase db reset   # Reset local to match
```

### Build artifacts appearing in git

Native folders (`ios/`, `android/`) are gitignored. They regenerate automatically.

## Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes and test locally with `supabase db reset`
3. Commit using conventional commits: `feat(scope): description`
4. Push and create a PR

## Documentation

- **CLAUDE.md**: Detailed conventions for AI assistance
- **README.md**: This file - getting started guide
- **Supabase Docs**: https://supabase.com/docs

## License

[Add your license]

## Support

[Add contact/support information]
