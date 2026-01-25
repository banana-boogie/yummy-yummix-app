#!/usr/bin/env bash
set -euo pipefail

app_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
server_dir="$app_dir/../yyx-server"

env_file="$app_dir/.env.local"

ok=true

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] Docker CLI not found." >&2
  ok=false
fi

if command -v docker >/dev/null 2>&1; then
  if ! docker info >/dev/null 2>&1; then
    echo "[ERROR] Docker daemon not running or not accessible." >&2
    ok=false
  fi
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "[ERROR] Supabase CLI not found." >&2
  ok=false
else
  if [[ -d "$server_dir" ]]; then
    if ! (cd "$server_dir" && supabase status >/dev/null 2>&1); then
      echo "[ERROR] Supabase local stack not running (supabase status failed)." >&2
      ok=false
    fi
  else
    echo "[WARN] yyx-server directory not found; skipping supabase status." >&2
  fi
fi

if [[ ! -f "$env_file" ]]; then
  echo "[ERROR] $env_file missing. Create it and set EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY." >&2
  ok=false
else
  supa_url=$(grep -E '^EXPO_PUBLIC_SUPABASE_URL=' "$env_file" | tail -n 1 | cut -d '=' -f2-)
  supa_key=$(grep -E '^EXPO_PUBLIC_SUPABASE_ANON_KEY=' "$env_file" | tail -n 1 | cut -d '=' -f2-)
  dev_email=$(grep -E '^EXPO_PUBLIC_DEV_LOGIN_EMAIL=' "$env_file" | tail -n 1 | cut -d '=' -f2-)
  dev_pass=$(grep -E '^EXPO_PUBLIC_DEV_LOGIN_PASSWORD=' "$env_file" | tail -n 1 | cut -d '=' -f2-)

  if [[ -z "$supa_url" || -z "$supa_key" ]]; then
    echo "[ERROR] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in $env_file." >&2
    ok=false
  fi

  if [[ -z "$dev_email" || -z "$dev_pass" ]]; then
    echo "[WARN] Dev login credentials missing (EXPO_PUBLIC_DEV_LOGIN_EMAIL/PASSWORD)." >&2
  fi

  if [[ "$supa_url" == http://127.0.0.1:* ]]; then
    echo "[WARN] EXPO_PUBLIC_SUPABASE_URL uses 127.0.0.1. This will NOT work on a physical device." >&2
  fi
fi

if [[ "$ok" == false ]]; then
  echo "\nLocal dev check failed." >&2
  exit 1
fi

echo "Local dev check passed."
