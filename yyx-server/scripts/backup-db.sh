#!/bin/bash
# Database backup script for YummyYummix
# Run: npm run backup
#
# Requires DATABASE_URL in .env.local (get from Supabase Dashboard > Settings > Database > Connection string)

set -e

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/yyx_backup_$TIMESTAMP.sql"

mkdir -p "$BACKUP_DIR"

# Load environment
if [ -f .env.local ]; then
  source .env.local
elif [ -f .env ]; then
  source .env
fi

# Check prerequisites
if ! command -v pg_dump &> /dev/null; then
  echo "❌ pg_dump not found"
  echo "   Install: brew install libpq"
  echo "   Add to PATH: echo 'export PATH=\"/opt/homebrew/opt/libpq/bin:\$PATH\"' >> ~/.zshrc"
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not set"
  echo ""
  echo "Add to .env.local:"
  echo "  DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
  echo ""
  echo "Get it from: Supabase Dashboard > Settings > Database > Connection string (URI)"
  echo "Use the 'Transaction' pooler connection for backups."
  exit 1
fi

echo "🗄️  Starting database backup..."

# Disable GSSAPI (fixes macOS issues with Supabase pooler)
export PGGSSENCMODE=disable

# Run pg_dump with public schema only (excludes internal Supabase schemas)
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-acl \
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
