#!/bin/bash
# Usage: ./update-dashboard.sh "task description" "status" "agent" "est_minutes"
# status: start | complete | fail
# est_minutes: estimated minutes to completion (for start only)
#
# Updates dashboard via the /api/update HTTP endpoint (primary)
# Falls back to direct Supabase PATCH if API is unreachable.

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
DASHBOARD_API="${CASPER_DASHBOARD_URL:-https://casperops.vercel.app}/api/update"
SUPABASE_URL="https://stboueshyjvooiftfuxm.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Ym91ZXNoeWp2b29pZnRmdXhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDA0MDAsImV4cCI6MjA4NjMxNjQwMH0.posxmZ-SQAm0Y9VQwtD5VSt7LQrOM23J9h2oG3SCmKU"

TASK="$1"
STATUS="$2"
AGENT="${3:-CMO (Casper)}"
EST_MINS="${4:-}"

# ── Try API route first (atomic, reliable) ──────────────────────────────────
PAYLOAD=$(python3 -c "
import json, sys
payload = {
    'type': 'task',
    'task': sys.argv[1],
    'status': sys.argv[2],
    'agent': sys.argv[3],
}
est = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] else None
if est:
    payload['estMinutes'] = int(est)
print(json.dumps(payload))
" "$TASK" "$STATUS" "$AGENT" "$EST_MINS" 2>/dev/null)

API_HTTP_CODE=$(curl -s -o /tmp/dashboard_api_response.txt -w "%{http_code}" \
  -X POST "$DASHBOARD_API" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  --connect-timeout 5 \
  --max-time 10 \
  2>/dev/null || echo "000")

if [ "$API_HTTP_CODE" -ge 200 ] && [ "$API_HTTP_CODE" -lt 300 ]; then
  echo "Dashboard updated via API: ${STATUS} — ${TASK}"
  exit 0
fi

echo "API update failed (HTTP ${API_HTTP_CODE}), falling back to direct Supabase..." >&2

# ── Fallback: direct Supabase update ────────────────────────────────────────
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Auto-estimate if not provided
if [ -z "$EST_MINS" ]; then
  case "$AGENT" in
    *Codex*|*codex*) EST_MINS=3 ;;
    *Claude*|*claude*)
      case "$TASK" in
        *[Rr]esearch*) EST_MINS=5 ;;
        *[Bb]uild*|*[Cc]reate*|*PDF*|*html*) EST_MINS=8 ;;
        *[Ss]trategy*|*[Pp]lan*) EST_MINS=5 ;;
        *[Qq][Aa]*|*test*|*review*) EST_MINS=3 ;;
        *) EST_MINS=5 ;;
      esac
      ;;
    *) EST_MINS=5 ;;
  esac
fi

EST_DONE=$(date -u -v+${EST_MINS}M +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "+${EST_MINS} minutes" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "$NOW")

# Get current state
CURRENT=$(curl -s "${SUPABASE_URL}/rest/v1/dashboard_state?id=eq.1&select=state" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}")

if [ -z "$CURRENT" ] || [ "$CURRENT" = "[]" ]; then
  echo "Failed to fetch current state from Supabase" >&2
  exit 1
fi

# Build updated state via Python (stdin-based, no shell injection)
python3 - "$TASK" "$STATUS" "$AGENT" "$NOW" "$EST_DONE" <<'PYEOF' > /tmp/dashboard_update.json
import json, sys
from datetime import datetime, timedelta, timezone

task, status, agent, now, est_done = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]

# Read current state from stdin
raw = sys.stdin.read() if not sys.stdin.isatty() else '[]'
try:
    current = json.loads(raw)
    if isinstance(current, list) and len(current) > 0:
        current = current[0].get('state', {})
    elif isinstance(current, dict):
        current = current.get('state', current)
except:
    current = {}

# Auto-expire tasks older than 30 min
current['activeTasks'] = [
    t for t in current.get('activeTasks', [])
    if datetime.fromisoformat(t.get('startedAt','2000-01-01T00:00:00Z').replace('Z','+00:00')) > datetime.now(timezone.utc) - timedelta(minutes=30)
]

history_started_at = None
history_duration = None

if status == 'start':
    current['activeTasks'] = [t for t in current.get('activeTasks', []) if t.get('taskDescription') != task]
    current['activeTasks'].append({
        'id': f'task-{now}',
        'priority': 'high',
        'agentName': agent,
        'startedAt': now,
        'estCompletion': est_done,
        'taskDescription': task
    })
elif status == 'complete':
    started = None
    for t in current.get('activeTasks', []):
        if t.get('taskDescription') == task:
            started = t.get('startedAt')
            break
    current['activeTasks'] = [t for t in current.get('activeTasks', []) if t.get('taskDescription') != task]
    duration = '-'
    history_started_at = started or now
    if started:
        try:
            s = datetime.fromisoformat(started.replace('Z','+00:00'))
            e = datetime.fromisoformat(now.replace('Z','+00:00'))
            mins = int((e - s).total_seconds() / 60)
            secs = int((e - s).total_seconds() % 60)
            duration = f'{mins}m {secs}s' if mins > 0 else f'{secs}s'
            history_duration = duration
        except:
            pass
    completions = current.get('recentCompletions', [])
    completions.insert(0, {
        'id': f'comp-{now}',
        'duration': duration,
        'agentName': agent,
        'completedAt': now,
        'taskDescription': task
    })
    current['recentCompletions'] = completions[:10]
    current.setdefault('kpis', {})
    current['kpis']['tasksCompletedToday'] = current['kpis'].get('tasksCompletedToday', 0) + 1
elif status == 'fail':
    current['activeTasks'] = [t for t in current.get('activeTasks', []) if t.get('taskDescription') != task]
    errors = current.get('errorLog', [])
    errors.insert(0, {
        'id': f'err-{now}',
        'agent': agent,
        'message': task,
        'severity': 'high',
        'timestamp': now
    })
    current['errorLog'] = errors[:5]
    current.setdefault('kpis', {})
    current['kpis']['errorsToday'] = current['kpis'].get('errorsToday', 0) + 1

current['lastUpdated'] = now

output = {
    'dashboard': {'state': current, 'updated_at': now},
    'history': {'started_at': history_started_at, 'duration': history_duration}
}
print(json.dumps(output))
PYEOF

# Extract dashboard update and write to Supabase
python3 -c "import sys,json; d=json.load(open('/tmp/dashboard_update.json')); print(json.dumps(d['dashboard']))" > /tmp/dashboard_patch.json

PATCH_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
  "${SUPABASE_URL}/rest/v1/dashboard_state?id=eq.1" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d @/tmp/dashboard_patch.json)

if [ "$PATCH_CODE" -lt 200 ] || [ "$PATCH_CODE" -ge 300 ]; then
  echo "Supabase PATCH failed (HTTP ${PATCH_CODE})" >&2
  exit 1
fi

# Insert pipeline_history on completion
if [ "$STATUS" = "complete" ]; then
  python3 - "$TASK" "$AGENT" "$NOW" <<'PYEOF' > /tmp/dashboard_history.json
import json, sys

task, agent, now = sys.argv[1], sys.argv[2], sys.argv[3]
update = json.load(open('/tmp/dashboard_update.json'))
started_at = update['history'].get('started_at') or now
duration = update['history'].get('duration') or '-'

print(json.dumps({
    'pipeline_id': f'task-{now}',
    'name': task,
    'stages': ['Done'],
    'completed_stages': ['Done'],
    'started_at': started_at,
    'completed_at': now,
    'status': 'complete',
    'duration': duration,
    'tasks': [{'id': 't1', 'description': task, 'agentName': agent, 'status': 'complete', 'duration': duration}]
}))
PYEOF

  curl -s -o /dev/null -X POST \
    "${SUPABASE_URL}/rest/v1/pipeline_history" \
    -H "apikey: ${ANON_KEY}" \
    -H "Authorization: Bearer ${ANON_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d @/tmp/dashboard_history.json
fi

echo "Dashboard updated via Supabase fallback: ${STATUS} — ${TASK}"
