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

# ── Auto-archive completed pipelines to pipeline_history ──────────────────────
# Extract pipelines with status "complete" or "failed" and archive them.
archive_pipeline() {
  local pipeline_json="$1"

  # Extract fields using python3
  local pipeline_id name stages completed_stages started_at status tasks
  pipeline_id=$(echo "$pipeline_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id','unknown'))")
  name=$(echo "$pipeline_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('name','Unknown Pipeline'))")
  status=$(echo "$pipeline_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','complete'))")
  started_at=$(echo "$pipeline_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('startedAt', ''))")
  stages=$(echo "$pipeline_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('stages',[])))")
  completed_stages=$(echo "$pipeline_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('completedStages',[])))")
  tasks=$(echo "$pipeline_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('tasks', None)))")

  # Skip if no pipeline_id
  if [ -z "$pipeline_id" ] || [ "$pipeline_id" = "unknown" ]; then
    return
  fi

  # Check if this pipeline_id is already in history (avoid duplicates)
  local existing
  existing=$(curl -s -o /dev/null -w "%{http_code}" \
    "${SUPABASE_URL}/rest/v1/pipeline_history?pipeline_id=eq.${pipeline_id}&limit=1" \
    -H "apikey: ${SUPABASE_SERVICE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}")

  local count
  count=$(curl -s \
    "${SUPABASE_URL}/rest/v1/pipeline_history?pipeline_id=eq.${pipeline_id}&select=id" \
    -H "apikey: ${SUPABASE_SERVICE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    -H "Prefer: count=exact" | python3 -c "import sys,json; data=json.load(sys.stdin); print(len(data))" 2>/dev/null || echo "0")

  if [ "$count" -gt 0 ]; then
    echo "   ↳ Pipeline '${name}' already in history, skipping."
    return
  fi

  # Calculate duration if we have started_at
  local duration="unknown"
  if [ -n "$started_at" ]; then
    duration=$(python3 -c "
from datetime import datetime, timezone
try:
    start = datetime.fromisoformat('${started_at}'.replace('Z','+00:00'))
    end = datetime.fromisoformat('${NOW}'.replace('Z','+00:00'))
    diff = int((end - start).total_seconds())
    h, rem = divmod(diff, 3600)
    m, s = divmod(rem, 60)
    if h > 0:
        print(f'{h}h {m}m')
    else:
        print(f'{m}m {s}s')
except Exception as e:
    print('unknown')
" 2>/dev/null || echo "unknown")
  fi

  # Build archive payload
  local PAYLOAD
  PAYLOAD=$(python3 -c "
import json, sys
payload = {
    'pipeline_id': '${pipeline_id}',
    'name': '${name}',
    'stages': ${stages},
    'completed_stages': ${completed_stages},
    'started_at': '${started_at}' if '${started_at}' else None,
    'completed_at': '${NOW}',
    'status': '${status}',
    'duration': '${duration}',
    'tasks': ${tasks}
}
print(json.dumps(payload))
" 2>/dev/null)

  if [ -z "$PAYLOAD" ]; then
    echo "   ↳ Failed to build payload for '${name}', skipping." >&2
    return
  fi

  local ARCH_RESPONSE
  ARCH_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "${SUPABASE_URL}/rest/v1/pipeline_history" \
    -H "apikey: ${SUPABASE_SERVICE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "$PAYLOAD")

  local ARCH_CODE
  ARCH_CODE=$(echo "$ARCH_RESPONSE" | tail -1)

  if [ "$ARCH_CODE" -ge 200 ] && [ "$ARCH_CODE" -lt 300 ]; then
    echo "   📦 Archived pipeline '${name}' (${status}) to history."
  else
    echo "   ⚠️  Failed to archive '${name}' (HTTP ${ARCH_CODE})" >&2
  fi
}

# Check for completed/failed pipelines and archive them
PIPELINES_JSON=$(echo "$STATE_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
pipelines = data.get('pipelines', [])
done = [p for p in pipelines if p.get('status') in ('complete', 'failed')]
for p in done:
    print(json.dumps(p))
" 2>/dev/null || true)

if [ -n "$PIPELINES_JSON" ]; then
  echo "🔍 Checking completed pipelines for archiving..."
  while IFS= read -r pipeline_line; do
    if [ -n "$pipeline_line" ]; then
      archive_pipeline "$pipeline_line"
    fi
  done <<< "$PIPELINES_JSON"
fi
# ─────────────────────────────────────────────────────────────────────────────

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
