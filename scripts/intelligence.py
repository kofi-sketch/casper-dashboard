#!/usr/bin/env python3
"""
Intelligence Agent — Daily 6AM run
Scans X, analyzes performance, finds opportunities, drafts content, queues replies.
"""

import subprocess
import json
import os
import sys
from datetime import datetime, timezone

SUPABASE_URL = "https://stboueshyjvooiftfuxm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Ym91ZXNoeWp2b29pZnRmdXhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDA0MDAsImV4cCI6MjA4NjMxNjQwMH0.posxmZ-SQAm0Y9VQwtD5VSt7LQrOM23J9h2oG3SCmKU"

def xurl(cmd, app=None):
    """Run xurl command and return parsed JSON"""
    full_cmd = ["xurl"] + cmd.split()
    if app:
        full_cmd.extend(["--app", app])
    try:
        result = subprocess.run(full_cmd, capture_output=True, text=True, timeout=15)
        return json.loads(result.stdout) if result.stdout.strip() else None
    except:
        return None

def supabase_insert(table, data):
    """Insert into Supabase table"""
    import urllib.request
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{table}",
        data=json.dumps(data).encode(),
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"  ❌ Supabase insert error: {e}")
        return None

def supabase_query(table, params=""):
    """Query Supabase table"""
    import urllib.request
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{table}?{params}",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except:
        return []

# ============================================================
# STEP 1: Scan target accounts for high-performing posts
# ============================================================
def scan_target_accounts():
    print("\n📡 STEP 1: Scanning target accounts...")
    accounts = supabase_query("target_accounts", "niche=neq.own-account&order=followers.desc&limit=50")
    
    if not accounts:
        print("  No target accounts to scan yet. Scanning trending topics instead.")
        return scan_trending()
    
    findings = []
    for acc in accounts[:20]:  # Top 20 by followers
        handle = acc["handle"].replace("@", "")
        data = xurl(f'search "from:{handle}" -n 5')
        if data and "data" in data:
            for tweet in data["data"]:
                metrics = tweet.get("public_metrics", {})
                likes = metrics.get("like_count", 0)
                rts = metrics.get("retweet_count", 0)
                imps = metrics.get("impression_count", 1)
                
                # Engagement score = weighted engagement relative to impressions
                score = (likes * 2 + rts * 3) / max(imps, 1) * 100
                
                if likes >= 10:  # Only high performers
                    findings.append({
                        "author_handle": f"@{handle}",
                        "author_followers": acc["followers"],
                        "post_preview": tweet["text"][:280],
                        "post_url": f"https://x.com/{handle}/status/{tweet['id']}",
                        "engagement_score": round(score, 2),
                        "status": "new"
                    })
    
    findings.sort(key=lambda x: x["engagement_score"], reverse=True)
    return findings[:20]  # Top 20

def scan_trending():
    """Scan trending topics when no target accounts exist"""
    print("  Scanning trending topics...")
    queries = [
        "side hustle income 2026",
        "multiple income streams",
        "freelancer money tracking",
        "building in public",
        "creator economy",
        "stoicism entrepreneur",
        "quit 9 to 5",
        "tax season freelancer",
        "passive income",
        "digital nomad finance"
    ]
    
    findings = []
    for q in queries:
        data = xurl(f'search "{q}" -n 10')
        if data and "data" in data:
            for tweet in data["data"]:
                metrics = tweet.get("public_metrics", {})
                likes = metrics.get("like_count", 0)
                rts = metrics.get("retweet_count", 0)
                imps = metrics.get("impression_count", 1)
                author_id = tweet.get("author_id", "unknown")
                
                score = (likes * 2 + rts * 3) / max(imps, 1) * 100
                
                if likes >= 3:  # Lower threshold for trending scan
                    findings.append({
                        "author_handle": f"user_{author_id}",
                        "author_followers": 0,
                        "post_preview": tweet["text"][:280],
                        "post_url": f"https://x.com/i/status/{tweet['id']}",
                        "engagement_score": round(score, 2),
                        "status": "new"
                    })
    
    findings.sort(key=lambda x: x["engagement_score"], reverse=True)
    return findings[:20]

# ============================================================
# STEP 2: Draft content based on findings
# ============================================================
def draft_content(findings):
    print("\n✍️  STEP 2: Drafting content...")
    
    # Time slots for today (UTC-3 Paraguay time)
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    time_slots = [
        ("08:00", "@igobykofi"),   # Morning philosophical
        ("09:00", "@gettraqd"),    # Morning product
        ("12:00", "@igobykofi"),   # Midday insight
        ("14:00", "@gettraqd"),    # Afternoon product
        ("17:00", "@igobykofi"),   # Evening reflection
        ("20:00", "@gettraqd"),    # Night engagement
    ]
    
    # Content templates based on brand voices
    igobykofi_templates = [
        # Stoic/philosophical
        "Marcus Aurelius said \"The impediment to action advances action. What stands in the way becomes the way.\"\n\nI moved to Paraguay with two startups and zero certainty.\n\nThe obstacle wasn't the language barrier or the timezone gap — it was thinking I needed everything figured out first.\n\nYou don't. Start moving.",
        
        # Building in public
        "Building two companies from Asunción, Paraguay.\n\nMonth 2 update:\n→ @gettraqd waitlist: growing\n→ @FlowAudit: clients coming in\n→ Sleep: questionable\n→ Conviction: unwavering\n\nThe hardest part isn't the work. It's trusting the process when nobody's watching.",
        
        # Philosophical + practical
        "Socrates never had a side hustle.\n\nBut he understood something most entrepreneurs miss: the unexamined business isn't worth building.\n\nEvery week I ask myself:\n- Am I solving a real problem?\n- Would I use this if I didn't build it?\n- Am I building for ego or impact?\n\nThe answers change everything.",
        
        # Travel/expat life
        "Living in Paraguay taught me more about business than any course.\n\nWhen you're 5,000 miles from your comfort zone:\n- You learn to figure things out fast\n- You stop waiting for permission\n- You realize most \"problems\" are just decisions\n\nThe best MBA is a one-way ticket.",
        
        # Contrarian
        "Unpopular opinion: Tracking your income is more important than growing it.\n\nI know people making $10k/month who have no idea where it comes from.\n\nThat's not wealth. That's chaos with a nice paycheck.\n\nClarity first. Growth follows.",
    ]
    
    gettraqd_templates = [
        # Pain point
        "You made money from 5 different platforms last month.\n\nCan you tell me exactly how much?\n\nFrom where?\n\nAfter expenses?\n\nIf you hesitated — that's the problem Traqd solves.\n\nOne screenshot. One dashboard. Total clarity.",
        
        # Comparison
        "QuickBooks: $37/month. Built for accountants.\nFreshBooks: $19/month. Built for invoicing.\nSpreadsheets: Free. Built for nobody.\n\nTraqd: $8.25/month. Built for people who actually hustle.\n\nIf you earn from multiple platforms, nothing else was built for you. Until now.",
        
        # Social proof angle
        "\"I spent 3 days doing my taxes because I couldn't find half my income.\"\n\nThis is what our waitlist subscribers keep telling us.\n\n3 days.\n\nWith Traqd, it takes 3 minutes.\n\nScreenshot → AI extracts → Done.\n\nJoin the waitlist → traqd.io",
        
        # Feature tease
        "What if you could ask your money a question?\n\n\"What's my best income source this quarter?\"\n\"Am I spending more than I earn?\"\n\"Which platform should I focus on?\"\n\nTraqd AI answers in seconds. From your real data.\n\nComing soon → traqd.io",
        
        # Urgency
        "Tax season is coming.\n\nYou have two choices:\n\n1. Spend 3-5 days piecing together income from every platform\n2. Screenshot your dashboards and let AI handle it\n\nOption 2 is Traqd.\n\nWaitlist is open. Launch price locks in forever.\n\ntraqd.io",
    ]
    
    drafts = []
    kofi_idx = 0
    traqd_idx = 0
    
    for time_slot, account in time_slots:
        scheduled = f"{today}T{time_slot}:00-03:00"
        
        if account == "@igobykofi":
            content = igobykofi_templates[kofi_idx % len(igobykofi_templates)]
            kofi_idx += 1
        else:
            content = gettraqd_templates[traqd_idx % len(gettraqd_templates)]
            traqd_idx += 1
        
        drafts.append({
            "account": account,
            "content": content,
            "scheduled_at": scheduled,
            "status": "draft"
        })
    
    return drafts

# ============================================================
# STEP 3: Queue reply opportunities
# ============================================================
def queue_replies(findings):
    print("\n💬 STEP 3: Queuing reply opportunities...")
    
    replies = []
    
    igobykofi_reply_styles = [
        "This resonates. Building from Paraguay, I see this every day — ",
        "Facts. The clarity problem is exactly why I'm building @gettraqd — ",
        "This is the part nobody talks about. ",
        "Needed to hear this today. ",
        "The Stoics called this 'premeditatio malorum' — anticipate the hard parts. ",
    ]
    
    gettraqd_reply_styles = [
        "This is exactly why we built Traqd — ",
        "Real talk. Multi-income earners deal with this daily. ",
        "The income fragmentation problem is real. ",
        "We hear this from every freelancer on our waitlist. ",
    ]
    
    for i, finding in enumerate(findings[:10]):
        # Alternate between accounts
        if i % 2 == 0:
            account = "@igobykofi"
            style = igobykofi_reply_styles[i % len(igobykofi_reply_styles)]
        else:
            account = "@gettraqd"
            style = gettraqd_reply_styles[i % len(gettraqd_reply_styles)]
        
        reply_text = f"{style}{finding['post_preview'][:50]}..."
        
        replies.append({
            "target_post_url": finding["post_url"],
            "target_author": finding["author_handle"],
            "suggested_reply": reply_text[:280],
            "account": account,
            "status": "queued"
        })
    
    return replies

# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    print("🧠 INTELLIGENCE AGENT — Running...")
    print(f"   Time: {datetime.now(timezone.utc).isoformat()}")
    
    # Step 1: Scan
    findings = scan_target_accounts()
    print(f"   Found {len(findings)} high-performing posts")
    
    if findings:
        # Insert research findings
        for f in findings:
            supabase_insert("content_research", f)
        print(f"   ✅ Inserted {len(findings)} research items")
    
    # Step 2: Draft content
    drafts = draft_content(findings)
    for d in drafts:
        supabase_insert("content_posts", d)
    print(f"   ✅ Created {len(drafts)} draft posts")
    
    # Step 3: Queue replies
    replies = queue_replies(findings)
    for r in replies:
        supabase_insert("content_replies", r)
    print(f"   ✅ Queued {len(replies)} replies")
    
    print("\n🎯 Intelligence run complete.")
    print(f"   Research: {len(findings)} findings")
    print(f"   Drafts: {len(drafts)} posts")
    print(f"   Replies: {len(replies)} queued")
