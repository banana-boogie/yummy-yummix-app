#!/bin/bash
# Storage backup script for YummyYummix
# Automatically backs up ALL buckets - no manual input needed
# Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local

set -e

# Load environment variables
if [ -f .env.local ]; then
    source .env.local
elif [ -f .env ]; then
    source .env
else
    echo "❌ No .env.local or .env file found"
    exit 1
fi

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
    exit 1
fi

BACKUP_DIR="backups/storage"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/$TIMESTAMP"

mkdir -p "$BACKUP_PATH"

echo "🔍 Discovering all storage buckets..."

# List ALL buckets automatically
BUCKETS=$(curl -s "$SUPABASE_URL/storage/v1/bucket" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" | jq -r '.[].name')

if [ -z "$BUCKETS" ]; then
  echo "⚠️  No buckets found or error fetching buckets"
  exit 0
fi

echo "📦 Found buckets: $BUCKETS"
echo ""

# Iterate through each bucket
for BUCKET in $BUCKETS; do
  echo "📁 Backing up bucket: $BUCKET"
  mkdir -p "$BACKUP_PATH/$BUCKET"

  # List all files in this bucket
  curl -s "$SUPABASE_URL/storage/v1/object/list/$BUCKET" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"prefix":"","limit":10000}' > "$BACKUP_PATH/$BUCKET/_file_list.json"

  FILE_COUNT=$(cat "$BACKUP_PATH/$BUCKET/_file_list.json" | jq '. | length')
  echo "   Found $FILE_COUNT files"

  # Download each file (handles nested paths)
  # Use 'authenticated' endpoint for private buckets (which is the default)
  cat "$BACKUP_PATH/$BUCKET/_file_list.json" | jq -r '.[].name' | while read filepath; do
    if [ -n "$filepath" ]; then
      # Create subdirectories if file is in nested path
      filedir=$(dirname "$filepath")
      if [ "$filedir" != "." ]; then
        mkdir -p "$BACKUP_PATH/$BUCKET/$filedir"
      fi

      echo "   ↓ $filepath"
      curl -s "$SUPABASE_URL/storage/v1/object/authenticated/$BUCKET/$filepath" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
        -o "$BACKUP_PATH/$BUCKET/$filepath"
    fi
  done

  echo "   ✓ Bucket '$BUCKET' complete"
  echo ""
done

# Create summary
echo "📊 Backup Summary:" > "$BACKUP_PATH/_summary.txt"
echo "Timestamp: $TIMESTAMP" >> "$BACKUP_PATH/_summary.txt"
echo "Buckets: $BUCKETS" >> "$BACKUP_PATH/_summary.txt"
du -sh "$BACKUP_PATH"/* >> "$BACKUP_PATH/_summary.txt" 2>/dev/null || true

echo "✅ Storage backup complete!"
echo "📁 Location: $BACKUP_PATH/"
cat "$BACKUP_PATH/_summary.txt"
