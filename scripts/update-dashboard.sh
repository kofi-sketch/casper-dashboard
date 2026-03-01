#!/bin/bash
# Usage: ./update-dashboard.sh "task description" "status" "agent"
# status: start | complete | fail
# This is called by ALL scripts and cron jobs automatically

SUPABASE_URL="https://stboueshyjvooiftfuxm.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Ym91ZXNoeWp2b29pZnRmdXhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDA0MDAsImV4cCI6MjA4NjMxNjQwMH0.posxmZ-SQAm0Y9VQwtD5VSt7LQrOM23J9h2oG3SCmKU"

TASK="$1"
STATUS="$2"
AGENT="${3:-CMO (Casper)}"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Get current state
CURRENT=$(curl -s "${SUPABASE_URL}/rest/v1/dashboard_state?id=eq.1&select=state" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}")

# Update state with python
python3 -c "
import json, sys

current = json.loads('''${CURRENT}''')[0]['state']
task = '''${TASK}'''
status = '''${STATUS}'''
agent = '''${AGENT}'''
now = '''${NOW}'''

if status == 'start':
    current['activeTasks'] = [t for t in current.get('activeTasks', []) if t.get('taskDescription') != task]
    current['activeTasks'].append({
        'id': f'task-{now}',
        'priority': 'high',
        'agentName': agent,
        'startedAt': now,
        'taskDescription': task
    })
elif status == 'complete':
    current['activeTasks'] = [t for t in current.get('activeTasks', []) if t.get('taskDescription') != task]
    completions = current.get('recentCompletions', [])
    completions.insert(0, {
        'id': f'comp-{now}',
        'duration': '-',
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
print(json.dumps({'state': current, 'updated_at': now}))
" > /tmp/dashboard_update.json

curl -s -X PATCH \
  "${SUPABASE_URL}/rest/v1/dashboard_state?id=eq.1" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d @/tmp/dashboard_update.json > /dev/null 2>&1

# Also insert into pipeline_history on completion
if [ "$STATUS" = "complete" ]; then
  curl -s -X POST \
    "${SUPABASE_URL}/rest/v1/pipeline_history" \
    -H "apikey: ${ANON_KEY}" \
    -H "Authorization: Bearer ${ANON_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "{\"pipeline_id\":\"task-${NOW}\",\"name\":\"${TASK}\",\"stages\":[\"Done\"],\"completed_stages\":[\"Done\"],\"started_at\":\"${NOW}\",\"completed_at\":\"${NOW}\",\"status\":\"complete\",\"duration\":\"-\"}" > /dev/null 2>&1
fi

echo "Dashboard updated: ${STATUS} — ${TASK}"
