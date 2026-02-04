#!/bin/bash
# Full backup script for YummyYummix
# Run: npm run backup
# Backs up both database and storage with the same timestamp

set -e

export BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🚀 Starting full backup (timestamp: $BACKUP_TIMESTAMP)"
echo ""

# Run database backup
bash scripts/backup-db.sh

echo ""

# Run storage backup
bash scripts/backup-storage.sh

echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ Full backup complete!"
echo "📁 Location: backups/$BACKUP_TIMESTAMP/"
echo "═══════════════════════════════════════════════════"
