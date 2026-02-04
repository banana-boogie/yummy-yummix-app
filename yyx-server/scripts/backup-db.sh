#!/bin/bash
# Database backup script for YummyYummix
# Run: npm run backup
#
# Uses Supabase CLI to get temporary credentials (no DATABASE_URL needed)

set -e

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/yyx_backup_$TIMESTAMP.sql"

mkdir -p "$BACKUP_DIR"

# Check prerequisites
if ! command -v pg_dump &> /dev/null; then
  echo "❌ pg_dump not found"
  echo "   Install: brew install libpq"
  echo "   Add to PATH: echo 'export PATH=\"/opt/homebrew/opt/libpq/bin:\$PATH\"' >> ~/.zshrc"
  exit 1
fi

if ! command -v supabase &> /dev/null; then
  echo "❌ supabase CLI not found"
  echo "   Install: brew install supabase/tap/supabase"
  exit 1
fi

echo "🔑 Getting credentials from Supabase CLI..."

# Extract credentials from supabase db dump --dry-run
CREDS=$(supabase db dump --dry-run 2>&1)

export PGHOST=$(echo "$CREDS" | grep 'export PGHOST=' | cut -d'"' -f2)
export PGPORT=$(echo "$CREDS" | grep 'export PGPORT=' | cut -d'"' -f2)
export PGUSER=$(echo "$CREDS" | grep 'export PGUSER=' | cut -d'"' -f2)
export PGPASSWORD=$(echo "$CREDS" | grep 'export PGPASSWORD=' | cut -d'"' -f2)
export PGDATABASE=$(echo "$CREDS" | grep 'export PGDATABASE=' | cut -d'"' -f2)

if [ -z "$PGHOST" ] || [ -z "$PGPASSWORD" ]; then
  echo "❌ Failed to extract credentials from Supabase CLI"
  echo "   Make sure you're logged in: supabase login"
  echo "   And linked to the project: supabase link"
  exit 1
fi

echo "🗄️  Starting database backup..."
echo "   Host: $PGHOST"
echo "   User: $PGUSER"

# Disable GSSAPI (fixes macOS issues with Supabase pooler)
export PGGSSENCMODE=disable

# Run pg_dump with public schema (includes data, not just schema)
pg_dump \
  --no-owner \
  --no-acl \
  --role postgres \
  --schema=public \
  > "$BACKUP_FILE"

# Check if backup succeeded
if [ ! -s "$BACKUP_FILE" ]; then
  echo "❌ Backup failed - empty file"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# Compress
gzip "$BACKUP_FILE"
BACKUP_SIZE=$(ls -lh "${BACKUP_FILE}.gz" | awk '{print $5}')

echo "✅ Backup created: ${BACKUP_FILE}.gz ($BACKUP_SIZE)"

# Cleanup old backups (keep last 10)
cd "$BACKUP_DIR"
ls -t *.gz 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true

echo ""
echo "📁 Recent backups:"
ls -lht *.gz 2>/dev/null | head -5
