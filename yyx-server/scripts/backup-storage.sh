#!/bin/bash
# Storage backup script for YummyYummix
# Automatically backs up ALL buckets recursively
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
TOTAL_FILES=0

mkdir -p "$BACKUP_PATH"

# Function to list and download files recursively
list_and_download() {
    local bucket="$1"
    local prefix="$2"
    local indent="$3"

    # List files/folders at this path
    local response=$(curl -s "$SUPABASE_URL/storage/v1/object/list/$bucket" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"prefix\":\"$prefix\",\"limit\":10000}")

    # Process each item
    echo "$response" | jq -c '.[]' 2>/dev/null | while read -r item; do
        local name=$(echo "$item" | jq -r '.name')
        local id=$(echo "$item" | jq -r '.id')

        # Build full path
        local fullpath
        if [ -z "$prefix" ]; then
            fullpath="$name"
        else
            fullpath="$prefix$name"
        fi

        if [ "$id" = "null" ]; then
            # It's a folder - recurse into it
            echo "${indent}📁 $name/"
            mkdir -p "$BACKUP_PATH/$bucket/$fullpath"
            list_and_download "$bucket" "$fullpath/" "  $indent"
        else
            # It's a file - download it
            echo "${indent}↓ $name"

            # Create parent directory if needed
            local filedir=$(dirname "$BACKUP_PATH/$bucket/$fullpath")
            mkdir -p "$filedir"

            # Download the file
            curl -s "$SUPABASE_URL/storage/v1/object/authenticated/$bucket/$fullpath" \
                -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
                -o "$BACKUP_PATH/$bucket/$fullpath"

            TOTAL_FILES=$((TOTAL_FILES + 1))
        fi
    done
}

echo "🔍 Discovering all storage buckets..."

# List ALL buckets automatically
BUCKETS=$(curl -s "$SUPABASE_URL/storage/v1/bucket" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" | jq -r '.[].name')

if [ -z "$BUCKETS" ]; then
  echo "⚠️  No buckets found or error fetching buckets"
  exit 0
fi

echo "📦 Found buckets:"
echo "$BUCKETS" | sed 's/^/   /'
echo ""

# Iterate through each bucket
for BUCKET in $BUCKETS; do
  echo "📁 Backing up bucket: $BUCKET"
  mkdir -p "$BACKUP_PATH/$BUCKET"

  list_and_download "$BUCKET" "" "   "

  echo "   ✓ Bucket '$BUCKET' complete"
  echo ""
done

# Create summary
TOTAL_SIZE=$(du -sh "$BACKUP_PATH" 2>/dev/null | cut -f1)
echo "📊 Backup Summary:" > "$BACKUP_PATH/_summary.txt"
echo "Timestamp: $TIMESTAMP" >> "$BACKUP_PATH/_summary.txt"
echo "Buckets: $(echo $BUCKETS | tr '\n' ' ')" >> "$BACKUP_PATH/_summary.txt"
echo "" >> "$BACKUP_PATH/_summary.txt"
echo "Size by bucket:" >> "$BACKUP_PATH/_summary.txt"
du -sh "$BACKUP_PATH"/*/ 2>/dev/null >> "$BACKUP_PATH/_summary.txt" || true

echo "✅ Storage backup complete!"
echo "📁 Location: $BACKUP_PATH/"
echo "📦 Total size: $TOTAL_SIZE"
echo ""
cat "$BACKUP_PATH/_summary.txt"
