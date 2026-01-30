#!/bin/bash
# Database backup script for YummyYummix
# Run: npm run backup

set -e

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/yyx_backup_$TIMESTAMP.sql"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "🗄️  Starting database backup..."
supabase db dump -f "$BACKUP_FILE"

# Compress the backup
gzip "$BACKUP_FILE"
echo "✅ Backup created: ${BACKUP_FILE}.gz"

# Keep only last 10 backups (optional)
cd "$BACKUP_DIR"
ls -t *.gz 2>/dev/null | tail -n +11 | xargs -r rm --
echo "🧹 Old backups cleaned (keeping last 10)"

echo "📁 Backup location: $BACKUP_DIR/"
ls -lh "$BACKUP_DIR"/*.gz 2>/dev/null | tail -5 || echo "No backups found"
