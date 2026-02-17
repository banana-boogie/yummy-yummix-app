# yyx-server

Backend for YummyYummix, built on Supabase Cloud with Edge Functions (Deno/TypeScript).

## Quick Start

```bash
npm run link          # Link to cloud project (first time only)
npm run deploy:all    # Deploy all edge functions
```

## Commands

```bash
# Deployment
npm run deploy irmixy-chat-orchestrator  # Deploy single function
npm run deploy:all          # Deploy all functions

# Database
npm run db:push             # Push migrations to cloud
npm run db:pull             # Pull schema from cloud
npm run migration:new name  # Create new migration

# Backups (ALWAYS run before migrations!)
npm run backup              # Database backup
npm run backup:storage      # Storage backup
npm run backup:all          # Both

# Testing
npm test                    # Run unit tests
npm run test:integration    # Integration tests
```

## Structure

```
yyx-server/
├── supabase/
│   ├── functions/          # Edge Functions
│   │   ├── irmixy-chat-orchestrator/
│   │   ├── irmixy-voice-orchestrator/
│   │   ├── get-nutritional-facts/
│   │   ├── parse-recipe-markdown/
│   │   └── _shared/        # Shared utilities
│   └── migrations/         # Database migrations
├── scripts/                # Backup scripts
├── backups/                # Local backups (gitignored)
└── .env.local              # Cloud credentials (gitignored)
```

## Environment Setup

```bash
cp .env.example .env.local
# Edit with your credentials from Supabase dashboard
```

See [CLAUDE.md](./CLAUDE.md) for detailed documentation.
