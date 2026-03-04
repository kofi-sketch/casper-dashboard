#!/bin/bash
# Email Watcher — sends emails when dashboard advances a subscriber's stage
# Runs via cron. NO LLM involved in send logic. Pure deterministic.

set -euo pipefail

SUPABASE_URL="https://stboueshyjvooiftfuxm.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Ym91ZXNoeWp2b29pZnRmdXhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDA0MDAsImV4cCI6MjA4NjMxNjQwMH0.posxmZ-SQAm0Y9VQwtD5VSt7LQrOM23J9h2oG3SCmKU"
CACHE_FILE="$(dirname "$0")/email-last-sent.json"
SEND_SCRIPT="$(dirname "$0")/../email-templates/send_emails.py"

# Ensure cache exists
if [ ! -f "$CACHE_FILE" ]; then
  echo '{}' > "$CACHE_FILE"
fi

# Pull all subscribers from Supabase
SUBS=$(curl -sf "${SUPABASE_URL}/rest/v1/email_subscribers?select=id,name,email,current_stage&status=eq.active" \
  -H "apikey: ${SUPABASE_KEY}")

if [ -z "$SUBS" ] || [ "$SUBS" = "[]" ]; then
  echo "NO_PENDING"
  exit 0
fi

CACHE=$(cat "$CACHE_FILE")
SENT_ANY=false

# Process each subscriber
echo "$SUBS" | python3 -c "
import json, sys, subprocess, os

subs = json.load(sys.stdin)
cache_file = '$CACHE_FILE'
send_script = '$SEND_SCRIPT'

with open(cache_file) as f:
    cache = json.load(f)

sent_any = False
for sub in subs:
    sid = sub['id']
    name = sub['name']
    email = sub['email']
    stage = sub['current_stage']
    last_sent = cache.get(sid, 0)
    
    if stage > last_sent:
        # Send all missing emails from last_sent+1 to stage
        for s in range(last_sent + 1, stage + 1):
            print(f'Sending email #{s} to {name} ({email})...')
            result = subprocess.run(
                ['python3', send_script, '--single', email, name, str(s)],
                capture_output=True, text=True, timeout=30
            )
            if result.returncode == 0:
                print(f'  ✅ {result.stdout.strip()}')
                cache[sid] = s
                sent_any = True
            else:
                print(f'  ❌ Failed: {result.stderr.strip()}')
                break  # Don't skip stages on failure

with open(cache_file, 'w') as f:
    json.dump(cache, f, indent=2)

if not sent_any:
    print('NO_PENDING')
"
