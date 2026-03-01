#!/usr/bin/env python3
"""
Reply Sniper — runs every 30 min
Takes queued replies and posts them via xurl.
"""

import subprocess
import json
import urllib.request
import re
from datetime import datetime, timezone

SUPABASE_URL = "https://stboueshyjvooiftfuxm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Ym91ZXNoeWp2b29pZnRmdXhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDA0MDAsImV4cCI6MjA4NjMxNjQwMH0.posxmZ-SQAm0Y9VQwtD5VSt7LQrOM23J9h2oG3SCmKU"

def supabase_get(table, params):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{table}?{params}",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def supabase_patch(table, filters, data):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{table}?{filters}",
        data=json.dumps(data).encode(),
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
        },
        method="PATCH"
    )
    with urllib.request.urlopen(req) as resp:
        return resp.read()

def extract_post_id(url):
    """Extract post ID from X URL"""
    match = re.search(r'/status/(\d+)', url)
    return match.group(1) if match else None

def send_reply(post_id, reply_text, account):
    app = "gettraqd" if account == "@gettraqd" else "kofi-personal"
    result = subprocess.run(
        ["xurl", "reply", post_id, reply_text, "--app", app],
        capture_output=True, text=True, timeout=15
    )
    return result.returncode == 0

if __name__ == "__main__":
    now = datetime.now(timezone.utc).isoformat()
    print(f"🎯 Reply Sniper — {now}")
    
    replies = supabase_get("content_replies", "status=eq.queued&order=created_at.asc&limit=10")
    
    if not replies:
        print("  No replies queued.")
        exit(0)
    
    sent = 0
    for reply in replies:
        post_id = extract_post_id(reply["target_post_url"])
        if not post_id:
            print(f"  ⚠️ Could not extract post ID from {reply['target_post_url']}")
            continue
        
        print(f"  Replying to {reply['target_author']}: {reply['suggested_reply'][:60]}...")
        
        if send_reply(post_id, reply["suggested_reply"], reply["account"]):
            supabase_patch("content_replies", f"id=eq.{reply['id']}", {
                "status": "sent",
                "sent_at": now
            })
            sent += 1
            print(f"  ✅ Sent as {reply['account']}")
        else:
            print(f"  ❌ Failed")
    
    print(f"  Done. Sent {sent}/{len(replies)} replies.")
