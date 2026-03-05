#!/bin/bash
# Usage: ./update-dashboard.sh "task description" "status" "agent" "est_minutes"
# status: start | complete | fail
# est_minutes: estimated minutes to completion (for start only)
#   If omitted, auto-estimates based on agent type:
#     Claude Code research: 3 min
#     Claude Code build: 4 min
#     Codex QA: 2 min
#     Default: 3 min

SUPABASE_URL="https://stboueshyjvooiftfuxm.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Ym91ZXNoeWp2b29pZnRmdXhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDA0MDAsImV4cCI6MjA4NjMxNjQwMH0.posxmZ-SQAm0Y9VQwtD5VSt7LQrOM23J9h2oG3SCmKU"

TASK="$1"
STATUS="$2"
AGENT="${3:-CMO (Casper)}"
EST_MINS="$4"
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

# Update state with python — pass variables via stdin to avoid shell injection
RESULT=$(echo "{\"current\": $(echo "$CURRENT" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)[0]['state']))"), \"task\": $(python3 -c "import json; print(json.dumps('''$TASK'''))"), \"status\": \"${STATUS}\", \"agent\": $(python3 -c "import json; print(json.dumps('''$AGENT'''))"), \"now\": \"${NOW}\", \"est_done\": \"${EST_DONE}\"}" | python3 -c "
import json, sys
from datetime import datetime, timedelta, timezone

inp = json.load(sys.stdin)
current = inp['current']
task = inp['task']
status = inp['status']
agent = inp['agent']
now = inp['now']
est_done = inp['est_done']

# Auto-expire tasks older than 30 min
current['activeTasks'] = [
    t for t in current.get('activeTasks', [])
    if datetime.fromisoformat(t.get('startedAt','2000-01-01T00:00:00Z').replace('Z','+00:00')) > datetime.now(timezone.utc) - timedelta(minutes=30)
]

# Track start time and duration for pipeline_history archival
history_started_at = None
history_duration = None

if status == 'start':
    # Remove duplicate task if re-starting
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
    # Find the task to calculate real duration
    started = None
    for t in current.get('activeTasks', []):
        if t.get('taskDescription') == task:
            started = t.get('startedAt')
            break

    # Remove from active
    current['activeTasks'] = [t for t in current.get('activeTasks', []) if t.get('taskDescription') != task]

    # Calculate duration
    duration = '-'
    if started:
        history_started_at = started
        try:
            s = datetime.fromisoformat(started.replace('Z','+00:00'))
            e = datetime.fromisoformat(now.replace('Z','+00:00'))
            mins = int((e - s).total_seconds() / 60)
            secs = int((e - s).total_seconds() % 60)
            duration = f'{mins}m {secs}s' if mins > 0 else f'{secs}s'
            history_duration = duration
        except:
            pass
    else:
        history_started_at = now

    completions = current.get('recentCompletions', [])
    completions.insert(0, {
        'id': f'comp-{now}',
        'duration': duration,
        'agentName': agent,
        'completedAt': now,
        'taskDescription': task
    })
    current['recentCompletions'] = completions[:10]
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
    current['kpis']['errorsToday'] = current['kpis'].get('errorsToday', 0) + 1

current['lastUpdated'] = now

# Output both the dashboard state update AND pipeline history data
output = {
    'dashboard': {'state': current, 'updated_at': now},
    'history': {
        'started_at': history_started_at,
        'duration': history_duration
    }
}
print(json.dumps(output))
")

# Extract dashboard state update
echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['dashboard']))" > /tmp/dashboard_update.json

curl -s -X PATCH \
  "${SUPABASE_URL}/rest/v1/dashboard_state?id=eq.1" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d @/tmp/dashboard_update.json > /dev/null 2>&1

# Also insert into pipeline_history on completion with correct start time + duration
if [ "$STATUS" = "complete" ]; then
  HIST_STARTED=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['history']['started_at'] or '$NOW')")
  HIST_DURATION=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['history']['duration'] or '-')")

  # Build the history payload safely via Python
  echo "{\"task\": $(python3 -c "import json; print(json.dumps('''$TASK'''))"), \"agent\": $(python3 -c "import json; print(json.dumps('''$AGENT'''))"), \"now\": \"${NOW}\", \"started_at\": \"${HIST_STARTED}\", \"duration\": \"${HIST_DURATION}\"}" | python3 -c "
import json, sys
inp = json.load(sys.stdin)
payload = {
    'pipeline_id': 'task-' + inp['now'],
    'name': inp['task'],
    'stages': ['Done'],
    'completed_stages': ['Done'],
    'started_at': inp['started_at'],
    'completed_at': inp['now'],
    'status': 'complete',
    'duration': inp['duration'],
    'tasks': [{
        'id': 't1',
        'description': inp['task'],
        'agentName': inp['agent'],
        'status': 'complete',
        'duration': inp['duration']
    }]
}
print(json.dumps(payload))
" > /tmp/dashboard_history.json

  curl -s -X POST \
    "${SUPABASE_URL}/rest/v1/pipeline_history" \
    -H "apikey: ${ANON_KEY}" \
    -H "Authorization: Bearer ${ANON_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d @/tmp/dashboard_history.json > /dev/null 2>&1
fi

echo "Dashboard updated: ${STATUS} — ${TASK}"
