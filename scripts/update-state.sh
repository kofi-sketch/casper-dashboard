#!/bin/bash
# Casper Dashboard State Updater
# Usage: ./scripts/update-state.sh '<json>'
# Or pipe: echo '{"kpis": {...}}' | ./scripts/update-state.sh
#
# Schema v2 — supports multi-pipeline "pipelines" array.
# Full state shape:
# {
#   "lastUpdated": "ISO8601",
#   "kpis": { "activeAgents": N, "tasksCompletedToday": N, "errorsToday": N },
#   "pipelines": [
#     {
#       "id": "string",
#       "name": "string",
#       "stages": ["Stage1", ...],
#       "currentStage": "Stage1",
#       "completedStages": [],
#       "startedAt": "ISO8601",
#       "status": "running|complete|failed"
#     }
#   ],
#   "activeTasks": [...],
#   "recentCompletions": [...],
#   "errorLog": [...],
#   "systemStatus": { "vercel": "connected", ... }
# }

set -euo pipefail

SUPABASE_URL="https://stboueshyjvooiftfuxm.supabase.co"

# Require service key
if [ -z "${SUPABASE_SERVICE_KEY:-}" ]; then
  echo "❌ Error: SUPABASE_SERVICE_KEY env var is not set." >&2
  echo "   Export it: export SUPABASE_SERVICE_KEY='your-service-role-key'" >&2
  exit 1
fi

# Read state from arg or stdin
if [ $# -ge 1 ] && [ -n "$1" ]; then
  STATE_JSON="$1"
elif [ ! -t 0 ]; then
  STATE_JSON=$(cat)
else
  echo "❌ Error: Provide state JSON as an argument or via stdin." >&2
  echo "   Usage: $0 '{\"kpis\": {...}, \"pipelines\": [...]}'" >&2
  exit 1
fi

# Validate it's parseable JSON
if ! echo "$STATE_JSON" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
  echo "❌ Error: Invalid JSON provided." >&2
  exit 1
fi

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH \
  "${SUPABASE_URL}/rest/v1/dashboard_state?id=eq.1" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "{\"state\": ${STATE_JSON}, \"updated_at\": \"${NOW}\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "✅ Dashboard state updated at ${NOW}"
else
  echo "❌ Failed to update state (HTTP ${HTTP_CODE}): ${BODY}" >&2
  exit 1
fi
