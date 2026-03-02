#!/bin/bash
# pipeline.sh — Enforcement wrapper for ACP agent pipeline
# Usage:
#   pipeline.sh start "<task>" "<agent>"
#   pipeline.sh complete "<task>" "<agent>"
#   pipeline.sh fail "<task>" "<agent>" "<error>"
#   pipeline.sh check
#
# Enforces: ACP-only agents, auto dashboard updates, chain instructions, state tracking.
# Channel-agnostic — works the same regardless of which channel triggered the pipeline.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STATE_FILE="/Users/AIAgenterminal/.openclaw/workspace/memory/pipeline-state.json"
LOG_FILE="/Users/AIAgenterminal/.openclaw/logs/pipeline.log"
DASHBOARD_SCRIPT="${SCRIPT_DIR}/update-dashboard.sh"

ALLOWED_AGENTS=("claude" "codex")

# Pipeline stages in order
STAGES=("research" "strategy" "build" "qa" "deliver")

log() {
  local msg="[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $*"
  echo "$msg" >> "$LOG_FILE"
  echo "$msg"
}

ensure_state_file() {
  if [ ! -f "$STATE_FILE" ]; then
    echo '{"active":[],"history":[]}' > "$STATE_FILE"
  fi
}

validate_agent() {
  local agent="$1"
  local agent_lower
  agent_lower=$(echo "$agent" | tr '[:upper:]' '[:lower:]')
  for allowed in "${ALLOWED_AGENTS[@]}"; do
    if [ "$agent_lower" = "$allowed" ]; then
      return 0
    fi
  done
  log "BLOCKED: Agent '$agent' is not an ACP agent. Only allowed: ${ALLOWED_AGENTS[*]}"
  echo ""
  echo "================================================================"
  echo "  ARCHITECTURE VIOLATION: Agent '$agent' is NOT allowed."
  echo "  Only ACP agents are permitted: ${ALLOWED_AGENTS[*]}"
  echo "  This is Directive #1. See DIRECTIVES.md."
  echo "================================================================"
  echo ""
  return 1
}

cmd_start() {
  local task="$1"
  local agent="$2"

  # Validate agent
  if ! validate_agent "$agent"; then
    exit 1
  fi

  # Update dashboard FIRST (Step 0)
  log "START: task='$task' agent='$agent'"
  bash "$DASHBOARD_SCRIPT" "$task" "start" "$agent"

  # Track in state file
  ensure_state_file
  python3 -c "
import json, sys
from datetime import datetime, timezone

with open('$STATE_FILE', 'r') as f:
    state = json.load(f)

now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
state['active'].append({
    'task': '''$task''',
    'agent': '''$agent''',
    'startedAt': now
})

with open('$STATE_FILE', 'w') as f:
    json.dump(state, f, indent=2)
"

  echo ""
  echo "--- Pipeline: STARTED ---"
  echo "  Task:  $task"
  echo "  Agent: $agent"
  echo "  Dashboard: updated"
  echo "  State: tracked"
  echo ""
  echo "  NEXT: Monitor agent. Check status within 2 minutes."
  echo "  If no output after 5 min, respawn with longer timeout."
  echo "-------------------------"
}

cmd_complete() {
  local task="$1"
  local agent="$2"

  # Update dashboard
  log "COMPLETE: task='$task' agent='$agent'"
  bash "$DASHBOARD_SCRIPT" "$task" "complete" "$agent"

  # Remove from state, add to history
  ensure_state_file
  python3 -c "
import json
from datetime import datetime, timezone

with open('$STATE_FILE', 'r') as f:
    state = json.load(f)

now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

# Find and remove from active
removed = None
new_active = []
for entry in state.get('active', []):
    if entry.get('task') == '''$task''':
        removed = entry
    else:
        new_active.append(entry)
state['active'] = new_active

# Add to history
history_entry = {
    'task': '''$task''',
    'agent': '''$agent''',
    'completedAt': now,
    'startedAt': removed.get('startedAt', now) if removed else now
}
state.setdefault('history', []).insert(0, history_entry)
state['history'] = state['history'][:50]  # Keep last 50

with open('$STATE_FILE', 'w') as f:
    json.dump(state, f, indent=2)
"

  # Determine next stage
  local agent_lower
  agent_lower=$(echo "$agent" | tr '[:upper:]' '[:lower:]')

  echo ""
  echo "=== Pipeline: COMPLETED ==="
  echo "  Task:  $task"
  echo "  Agent: $agent"
  echo "  Dashboard: updated"
  echo ""

  if [ "$agent_lower" = "codex" ]; then
    echo "  >>> QA COMPLETE. MANDATORY NEXT ACTIONS:"
    echo "  1. Send the deliverable file to the ACTIVE CONVERSATION (file first, then talk)"
    echo "  2. If QA rejected: respawn build agent with QA feedback"
    echo "  3. If QA approved: DELIVER NOW. No summary. File first."
  else
    echo "  >>> CHAIN NOW. MANDATORY NEXT ACTIONS:"
    echo "  Determine the next pipeline stage and spawn IMMEDIATELY."
    echo "  Pipeline: Research -> Strategy -> Build -> QA (codex) -> Deliver"
    echo "  Do NOT pause. Do NOT summarize. Do NOT wait for Kofi."
    echo "  Chain within 60 seconds. Use: pipeline.sh start \"<next task>\" \"<agent>\""
  fi
  echo "==========================="
}

cmd_fail() {
  local task="$1"
  local agent="$2"
  local error="${3:-Unknown error}"

  # Update dashboard
  log "FAIL: task='$task' agent='$agent' error='$error'"
  bash "$DASHBOARD_SCRIPT" "$task" "fail" "$agent"

  # Remove from state
  ensure_state_file
  python3 -c "
import json
from datetime import datetime, timezone

with open('$STATE_FILE', 'r') as f:
    state = json.load(f)

now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
state['active'] = [e for e in state.get('active', []) if e.get('task') != '''$task''']

state.setdefault('failures', []).insert(0, {
    'task': '''$task''',
    'agent': '''$agent''',
    'error': '''$error''',
    'failedAt': now
})
state['failures'] = state.get('failures', [])[:20]

with open('$STATE_FILE', 'w') as f:
    json.dump(state, f, indent=2)
"

  echo ""
  echo "!!! Pipeline: FAILED !!!"
  echo "  Task:  $task"
  echo "  Agent: $agent"
  echo "  Error: $error"
  echo "  Dashboard: updated with failure"
  echo ""
  echo "  ACTION: Diagnose and respawn, or escalate to Kofi."
  echo "!!!!!!!!!!!!!!!!!!!!!!!!"
}

cmd_check() {
  ensure_state_file
  python3 -c "
import json
from datetime import datetime, timezone

with open('$STATE_FILE', 'r') as f:
    state = json.load(f)

active = state.get('active', [])
now = datetime.now(timezone.utc)

if not active:
    print('No active agents.')
else:
    print(f'{len(active)} active agent(s):')
    for entry in active:
        started_str = entry.get('startedAt', '')
        task = entry.get('task', '?')
        agent = entry.get('agent', '?')
        age = '?'
        stale = False
        if started_str:
            try:
                started = datetime.fromisoformat(started_str.replace('Z', '+00:00'))
                delta = now - started
                mins = int(delta.total_seconds() / 60)
                age = f'{mins}m'
                if mins > 5:
                    stale = True
            except:
                pass
        status = ' ** STALE (>5min) — check for silent failure! **' if stale else ''
        print(f'  [{agent}] {task} — running {age}{status}')

recent = state.get('history', [])[:5]
if recent:
    print()
    print('Recent completions:')
    for h in recent:
        print(f'  [{h.get(\"agent\",\"?\")}] {h.get(\"task\",\"?\")} — completed {h.get(\"completedAt\",\"?\")[:16]}')
"
}

# Main dispatch
ACTION="${1:-}"
case "$ACTION" in
  start)
    [ -z "${2:-}" ] && { echo "Usage: pipeline.sh start \"<task>\" \"<agent>\""; exit 1; }
    [ -z "${3:-}" ] && { echo "Usage: pipeline.sh start \"<task>\" \"<agent>\""; exit 1; }
    cmd_start "$2" "$3"
    ;;
  complete)
    [ -z "${2:-}" ] && { echo "Usage: pipeline.sh complete \"<task>\" \"<agent>\""; exit 1; }
    [ -z "${3:-}" ] && { echo "Usage: pipeline.sh complete \"<task>\" \"<agent>\""; exit 1; }
    cmd_complete "$2" "$3"
    ;;
  fail)
    [ -z "${2:-}" ] && { echo "Usage: pipeline.sh fail \"<task>\" \"<agent>\" \"<error>\""; exit 1; }
    [ -z "${3:-}" ] && { echo "Usage: pipeline.sh fail \"<task>\" \"<agent>\" \"<error>\""; exit 1; }
    cmd_fail "$2" "$3" "${4:-Unknown error}"
    ;;
  check)
    cmd_check
    ;;
  *)
    echo "pipeline.sh — ACP Pipeline Enforcement"
    echo ""
    echo "Usage:"
    echo "  pipeline.sh start \"<task>\" \"<agent>\"     Start tracking + dashboard update"
    echo "  pipeline.sh complete \"<task>\" \"<agent>\"   Complete + dashboard + chain instructions"
    echo "  pipeline.sh fail \"<task>\" \"<agent>\" \"<error>\"  Log failure"
    echo "  pipeline.sh check                          Show active agents + staleness"
    echo ""
    echo "Allowed agents: ${ALLOWED_AGENTS[*]}"
    ;;
esac
