#!/bin/bash
# Database backup script for YummyYummix
# Run: npm run backup
#
# Uses Supabase CLI credentials with pg_dump directly (no Docker needed)

set -e

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/yyx_backup_$TIMESTAMP.sql"

mkdir -p "$BACKUP_DIR"

# Check prerequisites
if ! command -v supabase &> /dev/null; then
  echo "❌ Supabase CLI not found"
  echo "   Install: brew install supabase/tap/supabase"
  exit 1
fi

if ! command -v pg_dump &> /dev/null; then
  echo "❌ pg_dump not found"
  echo "   Install: brew install libpq"
  echo "   Add to PATH: echo 'export PATH=\"/opt/homebrew/opt/libpq/bin:\$PATH\"' >> ~/.zshrc"
  exit 1
fi

echo "🗄️  Starting database backup..."

# Get the pg_dump script from Supabase CLI and modify it for full backup with data
# (GSSAPI disabled - causes issues with Supabase's connection pooler on macOS)
(
  echo 'export PGGSSENCMODE=disable'
  supabase db dump --linked --dry-run 2>&1 | grep -A 100 '#!/usr/bin/env bash' | tail -n +2 | sed 's/--schema-only//'
) | bash > "$BACKUP_FILE" 2>&1

# Check if backup succeeded
if [ ! -s "$BACKUP_FILE" ]; then
  echo "❌ Backup failed - empty file"
  cat "$BACKUP_FILE" 2>/dev/null
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
