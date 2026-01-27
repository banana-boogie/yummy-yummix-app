#!/bin/bash

# Test Configuration Helper
# Detects environment and sets up appropriate test parameters

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Detect environment
detect_environment() {
    # Check if running against local or cloud Supabase
    if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:54321/rest/v1/" 2>/dev/null | grep -q "200\|401"; then
        echo "local"
    else
        echo "cloud"
    fi
}

# Get the base URL for API calls
get_base_url() {
    local env=$1
    if [ "$env" = "local" ]; then
        echo "http://127.0.0.1:54321/functions/v1"
    else
        # Read from environment or config file
        local cloud_url="${SUPABASE_FUNCTIONS_URL:-}"
        if [ -z "$cloud_url" ] && [ -f "../../.env" ]; then
            cloud_url=$(grep "SUPABASE_FUNCTIONS_URL" ../../.env 2>/dev/null | cut -d'=' -f2)
        fi
        echo "$cloud_url"
    fi
}

# Get a valid JWT token
get_jwt() {
    local env=$1

    if [ "$env" = "local" ]; then
        # Local: Get from Supabase auth
        local anon_key=$(supabase status -o json 2>/dev/null | jq -r '.ANON_KEY')
        local jwt=$(curl -s "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
            -H "apikey: $anon_key" \
            -H "Content-Type: application/json" \
            -d '{"email":"dev@yummyyummix.local","password":"devpassword123"}' | jq -r '.access_token // empty')
        echo "$jwt"
    else
        # Cloud: Use provided token or get from env
        echo "${YYX_JWT:-}"
    fi
}

# Check if AI endpoints will work (OpenAI key available)
check_ai_available() {
    local env=$1

    if [ "$env" = "local" ]; then
        # Check if OPENAI_API_KEY is set in .env.local (not a placeholder)
        local key=$(grep "OPENAI_API_KEY" .env.local 2>/dev/null | cut -d'=' -f2)
        if [ -n "$key" ] && [ "$key" != "sk-proj-test" ] && [[ "$key" == sk-* ]]; then
            echo "true"
        else
            echo "false"
        fi
    else
        # Cloud functions should have API key configured
        echo "true"
    fi
}

# Check if edge functions are being served locally
check_functions_served() {
    if pgrep -f "supabase functions serve" > /dev/null 2>&1; then
        echo "true"
    else
        echo "false"
    fi
}

# Start local function server if not running
ensure_functions_served() {
    if [ "$(check_functions_served)" = "false" ]; then
        echo -e "${YELLOW}Starting edge functions server...${NC}"
        cd "$(dirname "$0")/../.." || exit 1
        supabase functions serve --no-verify-jwt --env-file .env.local > /tmp/functions.log 2>&1 &
        sleep 5
        cd - > /dev/null || exit 1
    fi
}

# Print environment info
print_env_info() {
    local env=$(detect_environment)
    local base_url=$(get_base_url "$env")
    local ai_available=$(check_ai_available "$env")
    local functions_served=$(check_functions_served)

    echo -e "${BLUE}=== Test Environment ===${NC}"
    echo -e "  Environment: ${YELLOW}$env${NC}"
    echo -e "  Base URL: ${YELLOW}$base_url${NC}"
    echo -e "  AI Available: ${ai_available}"
    echo -e "  Functions Served: ${functions_served}"
    echo ""
}

# Export functions for sourcing
export -f detect_environment
export -f get_base_url
export -f get_jwt
export -f check_ai_available
export -f check_functions_served
export -f ensure_functions_served
export -f print_env_info

# If run directly, print environment info
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    print_env_info
fi
