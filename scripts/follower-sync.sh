#!/bin/bash
# Follower Sync — runs hourly
# Pulls real follower counts from X API and updates Supabase

SUPABASE_URL="https://stboueshyjvooiftfuxm.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Ym91ZXNoeWp2b29pZnRmdXhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDA0MDAsImV4cCI6MjA4NjMxNjQwMH0.posxmZ-SQAm0Y9VQwtD5VSt7LQrOM23J9h2oG3SCmKU"

# Get @gettraqd followers
TRAQD_FOLLOWERS=$(xurl whoami --app gettraqd 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['public_metrics']['followers_count'])" 2>/dev/null)

# Get @igobykofi followers  
KOFI_FOLLOWERS=$(xurl whoami --app kofi-personal 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['public_metrics']['followers_count'])" 2>/dev/null)

if [ -n "$TRAQD_FOLLOWERS" ]; then
  curl -s -X PATCH "$SUPABASE_URL/rest/v1/target_accounts?handle=eq.@gettraqd" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"followers\": $TRAQD_FOLLOWERS}"
  echo "✅ @gettraqd: $TRAQD_FOLLOWERS followers"
fi

if [ -n "$KOFI_FOLLOWERS" ]; then
  curl -s -X PATCH "$SUPABASE_URL/rest/v1/target_accounts?handle=eq.@igobykofi" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"followers\": $KOFI_FOLLOWERS}"
  echo "✅ @igobykofi: $KOFI_FOLLOWERS followers"
fi
