#!/usr/bin/env python3
"""
Post Scheduler — runs every 15 min
Finds scheduled posts that are due and publishes them via xurl.
"""

import subprocess
import json
import urllib.request
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

def post_tweet(content, account):
    app = "gettraqd" if account == "@gettraqd" else "kofi-personal"
    result = subprocess.run(
        ["xurl", "post", content, "--app", app],
        capture_output=True, text=True, timeout=15
    )
    if result.returncode == 0:
        data = json.loads(result.stdout)
        post_id = data.get("data", {}).get("id", "")
        return post_id
    else:
        print(f"  ❌ Failed to post: {result.stderr}")
        return None

if __name__ == "__main__":
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    print(f"📤 Post Scheduler — {now}")
    
    # Find scheduled posts that are due
    posts = supabase_get("content_posts", f"status=eq.scheduled&scheduled_at=lte.{now}&order=scheduled_at.asc")
    
    if not posts:
        print("  No posts due.")
        exit(0)
    
    for post in posts:
        if post["account"] == "@igobykofi":
            print(f"  ⏸️  SKIPPED (kofi-personal auth broken): {post['content'][:60]}...")
            continue
        print(f"  Publishing: {post['account']} — {post['content'][:60]}...")
        post_id = post_tweet(post["content"], post["account"])
        
        if post_id:
            supabase_patch("content_posts", f"id=eq.{post['id']}", {
                "status": "posted",
                "posted_at": now,
                "post_id": post_id
            })
            print(f"  ✅ Posted (ID: {post_id})")
        else:
            print(f"  ❌ Failed to post")
    
    print(f"  Done. Published {len(posts)} posts.")
